export const TASK3_PIPELINE_STATUSES = [
  "new_lead",
  "quoting",
  "quote_sent",
  "won",
  "lost",
] as const;

export type Task3PipelineStatus =
  (typeof TASK3_PIPELINE_STATUSES)[number];

export type Task3TransferReason =
  | "BUSY"
  | "NOT_SPECIALTY"
  | "OTHER";

export type Task3ActivityAction =
  | "STATUS_CHANGED"
  | "LEAD_RECEIVED"
  | "LEAD_TRANSFERRED"
  | "LEAD_UPDATED";

export type Task3LeadAction =
  | "UPDATE_PIPELINE"
  | "UPDATE_VALUES"
  | "REOPEN"
  | "RECEIVE"
  | "TRANSFER";

export interface Task3Lead {
  id: string;
  status: Task3PipelineStatus;
  assignedTo: string | null;
  receivedBy: string | null;
  receivedAt: Date | null;
  quoteSentAt: Date | null;
  respondedAt: Date | null;
  quoteValue: number | null;
  closedValue: number | null;
  closedAt: Date | null;
}

export interface Task3Activity {
  leadId: string;
  action: Task3ActivityAction;
  actorId: string;
  createdAt: Date;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  note: string | null;
  fromUserId: string | null;
  toUserId: string | null;
}

export interface Task3TransferCandidate {
  id: string;
  isActive: boolean;
  isOnline: boolean;
  canReceiveLead: boolean;
  activeLeadCount: number;
}

export type Task3Result<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export interface Task3PipelineInput {
  leadId: string;
  actorId: string;
  nextStatus: Task3PipelineStatus;
  failureReasonId?: string;
  quoteValue?: number | null;
  closedValue?: number | null;
  now?: Date;
}

export interface Task3ReopenInput {
  leadId: string;
  actorId: string;
  nextStatus: Task3PipelineStatus;
  reason: string;
  reopenWindowMs: number;
  now?: Date;
}

export interface Task3TransferInput {
  leadId: string;
  actorId: string;
  receiverId: string;
  reason: Task3TransferReason;
  note?: string;
  now?: Date;
}

export interface Task3ReceptionInput {
  leadId: string;
  actorId: string;
  now?: Date;
}

export interface Task3ValueInput {
  leadId: string;
  actorId: string;
  quoteValue?: number | null;
  closedValue?: number | null;
  now?: Date;
}

export interface Task3QuoteFollowupLead {
  id: string;
  status: Task3PipelineStatus;
  quoteSentAt: Date | null;
  respondedAt: Date | null;
}
