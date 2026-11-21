import {
  TASK3_PIPELINE_STATUSES,
  type Task3Lead,
  type Task3LeadAction,
  type Task3PipelineStatus,
  type Task3Result,
  type Task3TransferCandidate,
} from "./task3-contracts.ts";

const allowedTransitions: Record<
  Task3PipelineStatus,
  readonly Task3PipelineStatus[]
> = {
  new_lead: ["quoting", "lost"],
  quoting: ["quote_sent", "lost"],
  quote_sent: ["quoting", "won", "lost"],
  won: [],
  lost: [],
};

export type CapacityCheck = (
  sender: Task3TransferCandidate,
  receiver: Task3TransferCandidate
) => boolean;

export type Task3LeadAuthorizer = (
  actorId: number,
  lead: Task3Lead,
  action: Task3LeadAction
) => Promise<boolean>;

export function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function isValidValue(value: number | null | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    (Number.isSafeInteger(value) && value >= 0)
  );
}

export function validateActorAndTime(
  actorId: number,
  now: Date
): string | null {
  if (!Number.isSafeInteger(actorId) || actorId <= 0) {
    return "Thiếu người thực hiện";
  }
  if (!isValidDate(now)) {
    return "Thời gian không hợp lệ";
  }
  return null;
}

export function isTask3PipelineStatus(
  status: string
): status is Task3PipelineStatus {
  return (TASK3_PIPELINE_STATUSES as readonly string[]).includes(status);
}

export function validateTask3PipelineTransition(
  currentStatus: Task3PipelineStatus,
  nextStatus: Task3PipelineStatus,
  lostReason?: string
): Task3Result<null> {
  if (!isTask3PipelineStatus(currentStatus)) {
    return {
      success: false,
      error: "Trạng thái hiện tại không hợp lệ (E7)",
    };
  }
  if (!isTask3PipelineStatus(nextStatus)) {
    return {
      success: false,
      error: "Trạng thái mới không hợp lệ (E7)",
    };
  }
  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    return {
      success: false,
      error: "Chuyển trạng thái không hợp lệ (E7)",
    };
  }
  if (nextStatus === "lost" && !lostReason?.trim()) {
    return {
      success: false,
      error: "Bắt buộc chọn lý do thất bại",
    };
  }
  return { success: true, value: null };
}
