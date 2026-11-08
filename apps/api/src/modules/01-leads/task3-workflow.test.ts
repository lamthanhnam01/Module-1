import test from "node:test";
import assert from "node:assert/strict";

import {
  confirmTask3Reception,
  getTask3LeadHistory,
  getTask3PendingQuoteFollowups,
  reopenTask3Lead,
  transferTask3Lead,
  transitionTask3Lead,
  updateTask3LeadValues,
} from "./task3-workflow.ts";
import { validateTask3PipelineTransition } from "./task3-policy.ts";
import type {
  Task3Activity,
  Task3Lead,
  Task3TransferCandidate,
} from "./task3-contracts.ts";
import type {
  Task3Repository,
  Task3Transaction,
} from "./task3-repository.ts";
import type { Task3LeadAuthorizer } from "./task3-policy.ts";

const now = new Date("2026-11-07T10:00:00.000Z");

const lead: Task3Lead = {
  id: "L01",
  status: "quoting",
  assignedTo: "sales-01",
  receivedBy: null,
  receivedAt: null,
  quoteSentAt: null,
  respondedAt: null,
  quoteValue: null,
  closedValue: null,
  closedAt: null,
};

const sender: Task3TransferCandidate = {
  id: "sales-01",
  isActive: true,
  isOnline: true,
  canReceiveLead: true,
  activeLeadCount: 9,
};

const receiver: Task3TransferCandidate = {
  id: "sales-02",
  isActive: true,
  isOnline: true,
  canReceiveLead: true,
  activeLeadCount: 3,
};

const authorizeAssignedLead: Task3LeadAuthorizer = async (
  actorId,
  target
) => target.assignedTo === actorId;
const authorizeAnyLead: Task3LeadAuthorizer = async () => true;
const denyLead: Task3LeadAuthorizer = async () => false;

function createRepository(options?: {
  lead?: Task3Lead;
  sender?: Task3TransferCandidate | null;
  receiver?: Task3TransferCandidate | null;
  validFailureReason?: boolean;
  failAppendActivity?: boolean;
}) {
  const state = {
    lead: { ...(options?.lead ?? lead) },
    activities: [] as Task3Activity[],
    transactionCount: 0,
    updateCount: 0,
  };

  const repository: Task3Repository = {
    async transaction<T>(
      work: (transaction: Task3Transaction) => Promise<T>
    ): Promise<T> {
      state.transactionCount += 1;
      const workingLead = { ...state.lead };
      const workingActivities = [...state.activities];
      let workingUpdateCount = 0;
      const transaction: Task3Transaction = {
        async getLeadForUpdate(leadId) {
          return leadId === workingLead.id ? { ...workingLead } : null;
        },
        async getTransferCandidateForUpdate(userId) {
          if (userId === sender.id) {
            return options?.sender === null
              ? null
              : { ...(options?.sender ?? sender) };
          }
          if (userId === receiver.id) {
            return options?.receiver === null
              ? null
              : { ...(options?.receiver ?? receiver) };
          }
          return null;
        },
        async hasActiveFailureReason(reasonId) {
          return (
            reasonId === "reason-01" &&
            options?.validFailureReason !== false
          );
        },
        async updateLead(leadId, changes) {
          assert.equal(leadId, workingLead.id);
          Object.assign(workingLead, changes);
          workingUpdateCount += 1;
          return { ...workingLead };
        },
        async appendActivity(activity) {
          if (options?.failAppendActivity) {
            throw new Error("activity insert failed");
          }
          workingActivities.push(activity);
        },
      };

      const result = await work(transaction);
      state.lead = workingLead;
      state.activities = workingActivities;
      state.updateCount += workingUpdateCount;
      return result;
    },
  };
  return { repository, state };
}

test("Cho phép Pipeline theo thứ tự, lùi báo giá và thất bại từ trạng thái mở", () => {
  assert.equal(
    validateTask3PipelineTransition("new_lead", "quoting").success,
    true
  );
  assert.equal(
    validateTask3PipelineTransition("quoting", "quote_sent").success,
    true
  );
  assert.equal(
    validateTask3PipelineTransition("quote_sent", "quoting").success,
    true
  );
  assert.equal(
    validateTask3PipelineTransition("new_lead", "lost", "reason-01")
      .success,
    true
  );
  assert.equal(
    validateTask3PipelineTransition("won", "lost", "reason-01").success,
    true
  );
  assert.equal(
    validateTask3PipelineTransition("quoting", "won").success,
    false
  );
});

test("Chuyển trạng thái sai trả E7; thất bại thiếu lý do bị từ chối", async () => {
  assert.deepEqual(
    validateTask3PipelineTransition("new_lead", "won"),
    {
      success: false,
      error: "Chuyển trạng thái không hợp lệ (E7)",
    }
  );
  assert.deepEqual(
    validateTask3PipelineTransition("quoting", "lost"),
    {
      success: false,
      error: "Bắt buộc chọn lý do thất bại",
    }
  );

  const { repository, state } = createRepository();
  const skipped = await transitionTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "won",
      now,
    },
    authorizeAssignedLead
  );
  assert.deepEqual(skipped, {
    success: false,
    error: "Chuyển trạng thái không hợp lệ (E7)",
  });
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.updateCount, 0);
});

test("TC05: Pipeline, báo giá và lịch sử được ghi cùng transaction", async () => {
  const { repository, state } = createRepository();
  const result = await transitionTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "quote_sent",
      quoteValue: 1250000,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(result.success, true);
  assert.equal(state.transactionCount, 1);
  assert.equal(state.lead.status, "quote_sent");
  assert.equal(state.lead.quoteValue, 1250000);
  assert.equal(state.lead.quoteSentAt, now);
  assert.equal(state.activities.length, 2);
  assert.equal(state.activities[1].oldValue, null);
  assert.equal(state.activities[1].newValue, "1250000");
});

test("TC07: Chỉ chấp nhận lý do thất bại đang có trong danh mục", async () => {
  const { repository, state } = createRepository({
    validFailureReason: false,
  });
  const result = await transitionTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "lost",
      failureReasonId: "reason-01",
      now,
    },
    authorizeAssignedLead
  );

  assert.deepEqual(result, {
    success: false,
    error: "Lý do thất bại không có trong danh mục",
  });
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.updateCount, 0);
  assert.equal(state.activities.length, 0);
});

test("Đóng thành công lưu thời điểm đóng và giá trị chốt", async () => {
  const { repository, state } = createRepository({
    lead: { ...lead, status: "quote_sent" },
  });
  const result = await transitionTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "won",
      closedValue: 1000000,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(result.success, true);
  assert.equal(state.lead.status, "won");
  assert.equal(state.lead.closedAt, now);
  assert.equal(state.lead.closedValue, 1000000);
});

test("Nhập giá trị báo giá và giá trị chốt độc lập, ghi lịch sử cũ/mới", async () => {
  const { repository, state } = createRepository();
  const result = await updateTask3LeadValues(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      quoteValue: 900000,
      closedValue: 0,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(result.success, true);
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.lead.quoteValue, 900000);
  assert.equal(state.lead.closedValue, 0);
  assert.equal(state.activities.length, 2);
  assert.equal(state.activities[0].oldValue, null);
  assert.equal(state.activities[0].newValue, "900000");
  assert.equal(state.activities[1].newValue, "0");
});

test("Lùi Đã gửi báo giá về Đang soạn báo giá và từ chối giá trị âm", async () => {
  const { repository, state } = createRepository({
    lead: { ...lead, status: "quote_sent", quoteSentAt: now },
  });
  const backward = await transitionTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "quoting",
      now,
    },
    authorizeAssignedLead
  );
  const negative = await updateTask3LeadValues(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      quoteValue: -1,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(backward.success, true);
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.lead.quoteSentAt, null);
  assert.equal(negative.success, false);
});

test("Từ chối giá trị không hợp lệ trước khi ghi", async () => {
  const { repository, state } = createRepository();
  const result = await transitionTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "quote_sent",
      quoteValue: Number.NaN,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(result.success, false);
  assert.equal(state.transactionCount, 0);
  assert.equal(state.updateCount, 0);
});

test("Kiểm tra quyền máy chủ trước khi cập nhật Pipeline", async () => {
  const { repository, state } = createRepository();
  const result = await transitionTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-02",
      nextStatus: "quote_sent",
      now,
    },
    denyLead
  );

  assert.deepEqual(result, {
    success: false,
    error: "Không có quyền cập nhật Pipeline Lead",
  });
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.updateCount, 0);
  assert.equal(state.activities.length, 0);
});

test("Lỗi ghi lịch sử được truyền ra để DB transaction rollback", async () => {
  const { repository, state } = createRepository({
    failAppendActivity: true,
  });

  await assert.rejects(
    transitionTask3Lead(repository, {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "quote_sent",
      now,
    }, authorizeAssignedLead),
    /activity insert failed/
  );
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.activities.length, 0);
});

test("TC12: Mở lại Lead trong cửa sổ cấu hình, bắt buộc có lý do và ghi lịch sử", async () => {
  const closedLead: Task3Lead = {
    ...lead,
    status: "lost",
    closedAt: new Date("2026-11-01T10:00:00.000Z"),
  };
  const { repository, state } = createRepository({ lead: closedLead });
  const result = await reopenTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "quoting",
      reason: "Khách hàng quay lại",
      reopenWindowMs: 7 * 24 * 60 * 60 * 1000,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(result.success, true);
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.lead.closedAt, null);
  assert.equal(state.activities[0].oldValue, "lost");
  assert.equal(state.activities[0].newValue, "quoting");
  assert.equal(state.activities[0].reason, "Khách hàng quay lại");
});

test("Mở lại ở trạng thái đã gửi báo giá tạo mốc theo dõi mới", async () => {
  const { repository, state } = createRepository({
    lead: {
      ...lead,
      status: "won",
      quoteSentAt: new Date("2026-10-30T10:00:00.000Z"),
      respondedAt: now,
      closedAt: new Date("2026-11-06T10:00:00.000Z"),
    },
  });
  const result = await reopenTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "quote_sent",
      reason: "Khách yêu cầu gửi lại báo giá",
      reopenWindowMs: 2 * 24 * 60 * 60 * 1000,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(result.success, true);
  assert.equal(state.lead.quoteSentAt, now);
  assert.equal(state.lead.respondedAt, null);
});

test("Từ chối mở lại khi quá hạn, thiếu lý do hoặc chọn trạng thái đóng", async () => {
  const closedLead: Task3Lead = {
    ...lead,
    status: "won",
    closedAt: new Date("2026-11-01T10:00:00.000Z"),
  };
  const { repository, state } = createRepository({ lead: closedLead });
  const expired = await reopenTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "new_lead",
      reason: "Mở lại",
      reopenWindowMs: 1000,
      now,
    },
    authorizeAssignedLead
  );
  const missingReason = await reopenTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "quoting",
      reason: " ",
      reopenWindowMs: 7 * 24 * 60 * 60 * 1000,
      now,
    },
    authorizeAssignedLead
  );
  const invalidStatus = await reopenTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      nextStatus: "won",
      reason: "Mở lại",
      reopenWindowMs: 7 * 24 * 60 * 60 * 1000,
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(expired.success, false);
  assert.equal(missingReason.success, false);
  assert.equal(invalidStatus.success, false);
  assert.equal(state.lead.status, "won");
  assert.equal(state.activities.length, 0);
});

test("TC06: Chuyển Lead giữ Pipeline và ghi người nhận/lý do", async () => {
  const { repository, state } = createRepository();
  const result = await transferTask3Lead(repository, {
    leadId: lead.id,
    actorId: "sales-01",
    receiverId: "sales-02",
    reason: "NOT_SPECIALTY",
    now,
  }, authorizeAssignedLead);

  assert.equal(result.success, true);
  assert.equal(state.lead.assignedTo, "sales-02");
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.activities[0].fromUserId, "sales-01");
  assert.equal(state.activities[0].toUserId, "sales-02");
  assert.equal(state.activities[0].reason, "NOT_SPECIALTY");
  assert.equal(state.activities[0].note, null);
});

test("TC06: Kiểm tra người nhận và tải việc trong transaction lúc xác nhận", async () => {
  const { repository, state } = createRepository();
  let capacityChecked = false;
  const result = await transferTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      receiverId: "sales-02",
      reason: "BUSY",
      note: "Bàn giao theo yêu cầu khách",
      now,
    },
    authorizeAssignedLead,
    (currentSender, currentReceiver) => {
      capacityChecked = true;
      return currentSender.activeLeadCount > currentReceiver.activeLeadCount;
    }
  );

  assert.equal(result.success, true);
  assert.equal(capacityChecked, true);
  assert.equal(state.lead.assignedTo, "sales-02");
  assert.equal(
    state.activities[0].note,
    "Bàn giao theo yêu cầu khách"
  );
});

test("Người quản lý được ủy quyền chuyển Lead, vẫn ghi Sales đang bàn giao", async () => {
  const { repository, state } = createRepository();
  const result = await transferTask3Lead(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-manager",
      receiverId: "sales-02",
      reason: "NOT_SPECIALTY",
      now,
    },
    authorizeAnyLead
  );

  assert.equal(result.success, true);
  assert.equal(state.activities[0].actorId, "sales-manager");
  assert.equal(state.activities[0].fromUserId, "sales-01");
  assert.equal(state.activities[0].toUserId, "sales-02");
});

test("Từ chối người nhận không hoạt động, offline hoặc không đủ tải việc", async () => {
  const inactive = createRepository({
    receiver: { ...receiver, isActive: false },
  });
  const offline = createRepository({
    receiver: { ...receiver, isOnline: false },
  });
  const insufficientCapacity = createRepository();
  const inactiveResult = await transferTask3Lead(
    inactive.repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      receiverId: "sales-02",
      reason: "NOT_SPECIALTY",
      now,
    },
    authorizeAssignedLead
  );
  const offlineResult = await transferTask3Lead(offline.repository, {
    leadId: lead.id,
    actorId: "sales-01",
    receiverId: "sales-02",
    reason: "NOT_SPECIALTY",
    now,
  }, authorizeAssignedLead);
  const capacityResult = await transferTask3Lead(
    insufficientCapacity.repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      receiverId: "sales-02",
      reason: "BUSY",
      now,
    },
    authorizeAssignedLead,
    () => false
  );

  assert.equal(inactiveResult.success, false);
  assert.equal(offlineResult.success, false);
  assert.equal(capacityResult.success, false);
  assert.equal(inactive.state.lead.assignedTo, "sales-01");
  assert.equal(offline.state.activities.length, 0);
  assert.equal(insufficientCapacity.state.activities.length, 0);
});

test("Lý do khác phải có nội dung; không chuyển Lead cho chính mình", async () => {
  const { repository } = createRepository();
  const missingNote = await transferTask3Lead(repository, {
    leadId: lead.id,
    actorId: "sales-01",
    receiverId: "sales-02",
    reason: "OTHER",
    now,
  }, authorizeAssignedLead);
  const selfTransfer = await transferTask3Lead(repository, {
    leadId: lead.id,
    actorId: "sales-01",
    receiverId: "sales-01",
    reason: "NOT_SPECIALTY",
    now,
  }, authorizeAssignedLead);

  assert.equal(missingNote.success, false);
  assert.equal(selfTransfer.success, false);
});

test("Xác nhận tiếp nhận ghi người/thời điểm, không đổi trạng thái", async () => {
  const { repository, state } = createRepository();
  const result = await confirmTask3Reception(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-01",
      now,
    },
    authorizeAssignedLead
  );

  assert.equal(result.success, true);
  assert.equal(state.lead.status, "quoting");
  assert.equal(state.lead.receivedBy, "sales-01");
  assert.equal(state.lead.receivedAt, now);
  assert.equal(state.activities[0].action, "LEAD_RECEIVED");
});

test("Từ chối xác nhận tiếp nhận khi không có quyền máy chủ", async () => {
  const { repository, state } = createRepository();
  const result = await confirmTask3Reception(
    repository,
    {
      leadId: lead.id,
      actorId: "sales-02",
      now,
    },
    denyLead
  );

  assert.deepEqual(result, {
    success: false,
    error: "Không có quyền xác nhận tiếp nhận Lead",
  });
  assert.equal(state.lead.receivedBy, null);
  assert.equal(state.updateCount, 0);
});

test("TC11: Danh sách báo giá chờ phản hồi loại đúng Lead và sắp xếp cũ trước", () => {
  const pending = getTask3PendingQuoteFollowups([
    {
      id: "L02",
      status: "quote_sent",
      quoteSentAt: new Date("2026-11-02T10:00:00.000Z"),
      respondedAt: null,
    },
    {
      id: "L01",
      status: "quote_sent",
      quoteSentAt: new Date("2026-11-01T10:00:00.000Z"),
      respondedAt: null,
    },
    {
      id: "L03",
      status: "quote_sent",
      quoteSentAt: new Date("2026-11-01T10:00:00.000Z"),
      respondedAt: now,
    },
    {
      id: "L04",
      status: "quoting",
      quoteSentAt: null,
      respondedAt: null,
    },
  ]);

  assert.deepEqual(
    pending.map(({ id }) => id),
    ["L01", "L02"]
  );
});

test("Lịch sử Lead lọc đúng Lead và sắp xếp mới nhất trước", () => {
  const activities: Task3Activity[] = [
    {
      leadId: "L01",
      action: "STATUS_CHANGED",
      actorId: "sales-01",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      field: "status",
      oldValue: "new_lead",
      newValue: "quoting",
      reason: null,
      note: null,
      fromUserId: null,
      toUserId: null,
    },
    {
      leadId: "L01",
      action: "LEAD_TRANSFERRED",
      actorId: "sales-01",
      createdAt: new Date("2026-11-02T10:00:00.000Z"),
      field: "assignedTo",
      oldValue: "sales-01",
      newValue: "sales-02",
      reason: "BUSY",
      note: null,
      fromUserId: "sales-01",
      toUserId: "sales-02",
    },
    {
      leadId: "L02",
      action: "STATUS_CHANGED",
      actorId: "sales-03",
      createdAt: now,
      field: "status",
      oldValue: "new_lead",
      newValue: "lost",
      reason: "reason-01",
      note: null,
      fromUserId: null,
      toUserId: null,
    },
  ];

  const result = getTask3LeadHistory(activities, "L01");
  assert.equal(result.length, 2);
  assert.equal(result[0].action, "LEAD_TRANSFERRED");
  assert.equal(result[1].action, "STATUS_CHANGED");
});
