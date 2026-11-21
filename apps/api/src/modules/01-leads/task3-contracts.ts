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
  | "LEAD_REOPENED"
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
  id: number;
  version: number;
  status: Task3PipelineStatus;
  assignedTo: number | null;
  receivedBy: number | null;
  receivedAt: Date | null;
  quoteSentAt: Date | null;
  respondedAt: Date | null;
  quoteValue: number | null;
  closedValue: number | null;
  closedAt: Date | null;
  statusChangedAt: Date;
  lostReason: string | null;
  reopenCount: number;
}

export interface Task3Activity {
  leadId: number;
  action: Task3ActivityAction;
  actorId: number;
  createdAt: Date;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  note: string | null;
  fromUserId: number | null;
  toUserId: number | null;
}

export interface Task3TransferCandidate {
  id: number;
  isActive: boolean;
  isOnline: boolean;
  canReceiveLead: boolean;
  activeLeadCount: number;
}

export type Task3Result<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export interface Task3PipelineInput {
  leadId: number;
  actorId: number;
  expectedVersion?: number;
  nextStatus: Task3PipelineStatus;
  lostReason?: string;
  quoteValue?: number | null;
  closedValue?: number | null;
  now?: Date;
}

export interface Task3ReopenInput {
  leadId: number;
  actorId: number;
  expectedVersion?: number;
  nextStatus: Task3PipelineStatus;
  reason: string;
  reopenWindowMs: number;
  now?: Date;
}

export interface Task3TransferInput {
  leadId: number;
  actorId: number;
  expectedVersion?: number;
  receiverId: number;
  reason: Task3TransferReason;
  note?: string;
  now?: Date;
}

export interface Task3ReceptionInput {
  leadId: number;
  actorId: number;
  expectedVersion?: number;
  now?: Date;
}

export interface Task3ValueInput {
  leadId: number;
  actorId: number;
  expectedVersion?: number;
  quoteValue?: number | null;
  closedValue?: number | null;
  now?: Date;
}

export interface Task3QuoteFollowupLead {
  id: number;
  status: Task3PipelineStatus;
  quoteSentAt: Date | null;
  respondedAt: Date | null;
}
