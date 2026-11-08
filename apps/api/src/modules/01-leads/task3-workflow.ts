import type {
  Task3Activity,
  Task3ActivityAction,
  Task3Lead,
  Task3PipelineInput,
  Task3QuoteFollowupLead,
  Task3ReopenInput,
  Task3ReceptionInput,
  Task3Result,
  Task3TransferInput,
  Task3ValueInput,
} from "./task3-contracts.ts";
import {
  isValidDate,
  isValidValue,
  validateActorAndTime,
  validateTask3PipelineTransition,
  type CapacityCheck,
  type Task3LeadAuthorizer,
} from "./task3-policy.ts";
import type { Task3Repository } from "./task3-repository.ts";

function createActivity(
  leadId: string,
  action: Task3ActivityAction,
  actorId: string,
  now: Date,
  details: Partial<
    Pick<
      Task3Activity,
      | "field"
      | "oldValue"
      | "newValue"
      | "reason"
      | "note"
      | "fromUserId"
      | "toUserId"
    >
  > = {}
): Task3Activity {
  return {
    leadId,
    action,
    actorId,
    createdAt: now,
    field: details.field ?? null,
    oldValue: details.oldValue ?? null,
    newValue: details.newValue ?? null,
    reason: details.reason ?? null,
    note: details.note ?? null,
    fromUserId: details.fromUserId ?? null,
    toUserId: details.toUserId ?? null,
  };
}

export async function transitionTask3Lead(
  repository: Task3Repository,
  input: Task3PipelineInput,
  authorize: Task3LeadAuthorizer
): Promise<Task3Result<Task3Lead>> {
  const actorId = input.actorId.trim();
  const now = input.now ?? new Date();
  const actorError = validateActorAndTime(actorId, now);
  if (actorError) {
    return { success: false, error: actorError };
  }
  if (!isValidValue(input.quoteValue) || !isValidValue(input.closedValue)) {
    return {
      success: false,
      error: "Giá trị báo giá và giá trị chốt phải là số hữu hạn không âm",
    };
  }

  return repository.transaction(async (transaction) => {
    const lead = await transaction.getLeadForUpdate(input.leadId);
    if (!lead) {
      return { success: false, error: "Không tìm thấy Lead" };
    }
    if (!(await authorize(actorId, lead, "UPDATE_PIPELINE"))) {
      return { success: false, error: "Không có quyền cập nhật Pipeline Lead" };
    }

    const transition = validateTask3PipelineTransition(
      lead.status,
      input.nextStatus,
      input.failureReasonId
    );
    if (!transition.success) {
      return transition;
    }

    const failureReasonId = input.failureReasonId?.trim();
    if (
      input.nextStatus === "lost" &&
      (!failureReasonId ||
        !(await transaction.hasActiveFailureReason(failureReasonId)))
    ) {
      return {
        success: false,
        error: "Lý do thất bại không có trong danh mục",
      };
    }

    const changes: Partial<Omit<Task3Lead, "id">> = {
      status: input.nextStatus,
    };
    if (input.quoteValue !== undefined) {
      changes.quoteValue = input.quoteValue;
    }
    if (input.closedValue !== undefined) {
      changes.closedValue = input.closedValue;
    }
    if (input.nextStatus === "won" || input.nextStatus === "lost") {
      changes.closedAt = now;
    } else {
      changes.closedAt = null;
    }
    if (input.nextStatus === "quote_sent") {
      changes.quoteSentAt = now;
      changes.respondedAt = null;
    } else if (lead.status === "quote_sent") {
      changes.quoteSentAt = null;
    }

    const updatedLead = await transaction.updateLead(lead.id, changes);
    await transaction.appendActivity(
      createActivity(lead.id, "STATUS_CHANGED", actorId, now, {
        field: "status",
        oldValue: lead.status,
        newValue: input.nextStatus,
        reason: input.nextStatus === "lost" ? failureReasonId ?? null : null,
      })
    );

    if (
      updatedLead.quoteValue !== lead.quoteValue &&
      input.quoteValue !== undefined
    ) {
      await transaction.appendActivity(
        createActivity(lead.id, "LEAD_UPDATED", actorId, now, {
          field: "quoteValue",
          oldValue: lead.quoteValue?.toString() ?? null,
          newValue: updatedLead.quoteValue?.toString() ?? null,
        })
      );
    }
    if (
      updatedLead.closedValue !== lead.closedValue &&
      input.closedValue !== undefined
    ) {
      await transaction.appendActivity(
        createActivity(lead.id, "LEAD_UPDATED", actorId, now, {
          field: "closedValue",
          oldValue: lead.closedValue?.toString() ?? null,
          newValue: updatedLead.closedValue?.toString() ?? null,
        })
      );
    }

    return { success: true, value: updatedLead };
  });
}

export async function reopenTask3Lead(
  repository: Task3Repository,
  input: Task3ReopenInput,
  authorize: Task3LeadAuthorizer
): Promise<Task3Result<Task3Lead>> {
  const actorId = input.actorId.trim();
  const reason = input.reason.trim();
  const now = input.now ?? new Date();
  const actorError = validateActorAndTime(actorId, now);
  if (actorError) {
    return { success: false, error: actorError };
  }
  if (!reason) {
    return {
      success: false,
      error: "Bắt buộc nhập lý do mở lại Lead",
    };
  }
  if (!Number.isFinite(input.reopenWindowMs) || input.reopenWindowMs < 0) {
    return {
      success: false,
      error: "Thời hạn mở lại Lead chưa được cấu hình hợp lệ",
    };
  }
  if (
    input.nextStatus !== "new_lead" &&
    input.nextStatus !== "quoting" &&
    input.nextStatus !== "quote_sent"
  ) {
    return { success: false, error: "Trạng thái mở lại không hợp lệ" };
  }

  return repository.transaction(async (transaction) => {
    const lead = await transaction.getLeadForUpdate(input.leadId);
    if (!lead) {
      return { success: false, error: "Không tìm thấy Lead" };
    }
    if (!(await authorize(actorId, lead, "REOPEN"))) {
      return { success: false, error: "Không có quyền mở lại Lead" };
    }
    if (lead.status !== "won" && lead.status !== "lost") {
      return { success: false, error: "Chỉ có thể mở lại Lead đã đóng" };
    }
    if (!lead.closedAt || !isValidDate(lead.closedAt)) {
      return {
        success: false,
        error: "Không có thời điểm đóng Lead hợp lệ",
      };
    }

    const elapsedMs = now.getTime() - lead.closedAt.getTime();
    if (elapsedMs < 0 || elapsedMs > input.reopenWindowMs) {
      return {
        success: false,
        error: "Lead đã quá thời hạn được phép mở lại",
      };
    }

    const changes: Partial<Omit<Task3Lead, "id">> = {
      status: input.nextStatus,
      closedAt: null,
    };
    if (input.nextStatus === "quote_sent") {
      changes.quoteSentAt = now;
      changes.respondedAt = null;
    } else {
      changes.quoteSentAt = null;
      changes.respondedAt = null;
    }
    const updatedLead = await transaction.updateLead(lead.id, changes);
    await transaction.appendActivity(
      createActivity(lead.id, "STATUS_CHANGED", actorId, now, {
        field: "status",
        oldValue: lead.status,
        newValue: input.nextStatus,
        reason,
      })
    );
    return { success: true, value: updatedLead };
  });
}

export async function transferTask3Lead(
  repository: Task3Repository,
  input: Task3TransferInput,
  authorize: Task3LeadAuthorizer,
  capacityCheck?: CapacityCheck
): Promise<Task3Result<Task3Lead>> {
  const actorId = input.actorId.trim();
  const receiverId = input.receiverId.trim();
  const note = input.note?.trim() ?? "";
  const now = input.now ?? new Date();
  const actorError = validateActorAndTime(actorId, now);
  if (actorError) {
    return { success: false, error: actorError };
  }
  if (!receiverId) {
    return { success: false, error: "Thiếu người nhận Lead" };
  }
  if (
    input.reason !== "BUSY" &&
    input.reason !== "NOT_SPECIALTY" &&
    input.reason !== "OTHER"
  ) {
    return { success: false, error: "Lý do chuyển không hợp lệ" };
  }
  if (input.reason === "OTHER" && !note) {
    return {
      success: false,
      error: "Lý do khác phải có mô tả",
    };
  }
  if (input.reason === "BUSY" && !capacityCheck) {
    return {
      success: false,
      error: "Chưa cấu hình quy tắc tải việc",
    };
  }

  return repository.transaction(async (transaction) => {
    const lead = await transaction.getLeadForUpdate(input.leadId);
    if (!lead) {
      return { success: false, error: "Không tìm thấy Lead" };
    }
    if (lead.status === "won" || lead.status === "lost") {
      return { success: false, error: "Không thể chuyển Lead đã đóng" };
    }
    if (!(await authorize(actorId, lead, "TRANSFER"))) {
      return {
        success: false,
        error: "Không có quyền chuyển Lead",
      };
    }
    if (actorId === receiverId || lead.assignedTo === receiverId) {
      return {
        success: false,
        error: "Người nhận phải khác người chuyển và người đang phụ trách",
      };
    }
    if (!lead.assignedTo) {
      return {
        success: false,
        error: "Lead chưa có người phụ trách để chuyển giao",
      };
    }

    const sender = await transaction.getTransferCandidateForUpdate(
      lead.assignedTo
    );
    const receiver =
      await transaction.getTransferCandidateForUpdate(receiverId);
    if (!sender || !receiver) {
      return {
        success: false,
        error: "Không tìm thấy người chuyển hoặc người nhận",
      };
    }
    if (
      !receiver.isActive ||
      !receiver.isOnline ||
      !receiver.canReceiveLead
    ) {
      return {
        success: false,
        error: "Người nhận không đủ điều kiện",
      };
    }
    if (input.reason === "BUSY") {
      if (!capacityCheck) {
        return {
          success: false,
          error: "Chưa cấu hình quy tắc tải việc",
        };
      }
      if (!capacityCheck(sender, receiver)) {
        return {
          success: false,
          error: "Người nhận chưa đáp ứng điều kiện tải việc",
        };
      }
    }

    const updatedLead = await transaction.updateLead(lead.id, {
      assignedTo: receiverId,
    });
    await transaction.appendActivity(
      createActivity(lead.id, "LEAD_TRANSFERRED", actorId, now, {
        field: "assignedTo",
        oldValue: lead.assignedTo,
        newValue: receiverId,
        reason: input.reason,
        note: note || null,
        fromUserId: lead.assignedTo,
        toUserId: receiverId,
      })
    );
    return { success: true, value: updatedLead };
  });
}

export async function updateTask3LeadValues(
  repository: Task3Repository,
  input: Task3ValueInput,
  authorize: Task3LeadAuthorizer
): Promise<Task3Result<Task3Lead>> {
  const actorId = input.actorId.trim();
  const now = input.now ?? new Date();
  const actorError = validateActorAndTime(actorId, now);
  if (actorError) {
    return { success: false, error: actorError };
  }
  if (input.quoteValue === undefined && input.closedValue === undefined) {
    return {
      success: false,
      error: "Cần nhập giá trị báo giá hoặc giá trị chốt",
    };
  }
  if (!isValidValue(input.quoteValue) || !isValidValue(input.closedValue)) {
    return {
      success: false,
      error: "Giá trị báo giá và giá trị chốt phải là số hữu hạn không âm",
    };
  }

  return repository.transaction(async (transaction) => {
    const lead = await transaction.getLeadForUpdate(input.leadId);
    if (!lead) {
      return { success: false, error: "Không tìm thấy Lead" };
    }
    if (!(await authorize(actorId, lead, "UPDATE_VALUES"))) {
      return {
        success: false,
        error: "Không có quyền cập nhật giá trị Lead",
      };
    }

    const changes: Partial<Omit<Task3Lead, "id">> = {};
    if (input.quoteValue !== undefined) {
      changes.quoteValue = input.quoteValue;
    }
    if (input.closedValue !== undefined) {
      changes.closedValue = input.closedValue;
    }

    const updatedLead = await transaction.updateLead(lead.id, changes);
    if (
      updatedLead.quoteValue !== lead.quoteValue &&
      input.quoteValue !== undefined
    ) {
      await transaction.appendActivity(
        createActivity(lead.id, "LEAD_UPDATED", actorId, now, {
          field: "quoteValue",
          oldValue: lead.quoteValue?.toString() ?? null,
          newValue: updatedLead.quoteValue?.toString() ?? null,
        })
      );
    }
    if (
      updatedLead.closedValue !== lead.closedValue &&
      input.closedValue !== undefined
    ) {
      await transaction.appendActivity(
        createActivity(lead.id, "LEAD_UPDATED", actorId, now, {
          field: "closedValue",
          oldValue: lead.closedValue?.toString() ?? null,
          newValue: updatedLead.closedValue?.toString() ?? null,
        })
      );
    }

    return { success: true, value: updatedLead };
  });
}

export async function confirmTask3Reception(
  repository: Task3Repository,
  input: Task3ReceptionInput,
  authorize: Task3LeadAuthorizer
): Promise<Task3Result<Task3Lead>> {
  const actorId = input.actorId.trim();
  const now = input.now ?? new Date();
  const actorError = validateActorAndTime(actorId, now);
  if (actorError) {
    return { success: false, error: actorError };
  }

  return repository.transaction(async (transaction) => {
    const lead = await transaction.getLeadForUpdate(input.leadId);
    if (!lead) {
      return { success: false, error: "Không tìm thấy Lead" };
    }
    if (!(await authorize(actorId, lead, "RECEIVE"))) {
      return {
        success: false,
        error: "Không có quyền xác nhận tiếp nhận Lead",
      };
    }
    if (lead.assignedTo !== actorId) {
      return {
        success: false,
        error: "Chỉ người được giao Lead mới được xác nhận",
      };
    }
    if (lead.receivedAt || lead.receivedBy) {
      return {
        success: false,
        error: "Lead đã được xác nhận tiếp nhận",
      };
    }

    const updatedLead = await transaction.updateLead(lead.id, {
      receivedBy: actorId,
      receivedAt: now,
    });
    await transaction.appendActivity(
      createActivity(lead.id, "LEAD_RECEIVED", actorId, now, {
        field: "receivedAt",
        oldValue: null,
        newValue: now.toISOString(),
      })
    );
    return { success: true, value: updatedLead };
  });
}

export function getTask3PendingQuoteFollowups<T extends Task3QuoteFollowupLead>(
  leads: readonly T[]
): T[] {
  return leads
    .filter(
      (lead) =>
        lead.status === "quote_sent" &&
        lead.quoteSentAt !== null &&
        lead.respondedAt === null
    )
    .sort((left, right) => {
      const leftSentAt = left.quoteSentAt?.getTime() ?? 0;
      const rightSentAt = right.quoteSentAt?.getTime() ?? 0;
      const timeDifference = leftSentAt - rightSentAt;
      return timeDifference || left.id.localeCompare(right.id);
    });
}

export function getTask3LeadHistory(
  activities: readonly Task3Activity[],
  leadId: string
): Task3Activity[] {
  return activities
    .filter((activity) => activity.leadId === leadId)
    .sort((left, right) => {
      const timeDifference =
        right.createdAt.getTime() - left.createdAt.getTime();
      return (
        timeDifference ||
        left.action.localeCompare(right.action) ||
        left.actorId.localeCompare(right.actorId)
      );
    });
}
