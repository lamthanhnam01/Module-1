import type {
  Task3Activity,
  Task3Lead,
  Task3TransferCandidate,
} from "./task3-contracts.ts";

export interface Task3Transaction {
  getLeadForUpdate(leadId: number): Promise<Task3Lead | null>;
  getTransferCandidateForUpdate(
    userId: number
  ): Promise<Task3TransferCandidate | null>;
  hasActiveFailureReason(lostReason: string): Promise<boolean>;
  updateLead(
    leadId: number,
    expectedVersion: number,
    changes: Partial<Omit<Task3Lead, "id" | "version">>
  ): Promise<Task3Lead | null>;
  appendActivity(activity: Task3Activity): Promise<void>;
}

export interface Task3Repository {
  transaction<T>(
    work: (transaction: Task3Transaction) => Promise<T>
  ): Promise<T>;
}
