import type {
  Task3Activity,
  Task3Lead,
  Task3TransferCandidate,
} from "./task3-contracts.ts";

export interface Task3Transaction {
  getLeadForUpdate(leadId: string): Promise<Task3Lead | null>;
  getTransferCandidateForUpdate(
    userId: string
  ): Promise<Task3TransferCandidate | null>;
  hasActiveFailureReason(reasonId: string): Promise<boolean>;
  updateLead(
    leadId: string,
    changes: Partial<Omit<Task3Lead, "id">>
  ): Promise<Task3Lead>;
  appendActivity(activity: Task3Activity): Promise<void>;
}

export interface Task3Repository {
  transaction<T>(
    work: (transaction: Task3Transaction) => Promise<T>
  ): Promise<T>;
}
