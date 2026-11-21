import { Prisma, prisma } from "@toantrung/database";
import type {
  Task3Activity,
  Task3Lead,
  Task3TransferCandidate,
} from "./task3-contracts.ts";
import { isTask3PipelineStatus } from "./task3-policy.ts";
import type {
  Task3Repository,
  Task3Transaction,
} from "./task3-repository.ts";

export class Task3RepositoryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Task3RepositoryConfigurationError";
  }
}

export interface Task3PrismaRepositoryOptions {
  hasActiveFailureReason?: (
    lostReason: string,
    transaction: Prisma.TransactionClient,
  ) => Promise<boolean>;
  isUserOnline?: (
    userId: number,
    transaction: Prisma.TransactionClient,
  ) => Promise<boolean>;
}

type DbDate = Date | string | null;
type DbValue = bigint | number | null;

interface LeadRow {
  id: number;
  version: number;
  pipeline_status: string;
  lost_reason: string | null;
  quote_value: DbValue;
  deal_value: DbValue;
  assigned_sales_id: number | null;
  received_by_user_id: number | null;
  received_at: DbDate;
  first_quote_sent_at: DbDate;
  quote_responded_at: DbDate;
  closed_at: DbDate;
  status_changed_at: Date | string;
  reopen_count: number;
}

function toDate(value: DbDate): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Thời gian Lead trong DB không hợp lệ");
  }
  return date;
}

function toSafeNumber(value: DbValue): number | null {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error("Giá trị Lead vượt giới hạn số an toàn của API");
  }
  return number;
}

function toSafeBigInt(value: number | null | undefined): bigint | null | undefined {
  if (value === undefined || value === null) return value;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Giá trị tiền Lead phải là số nguyên không âm an toàn");
  }
  return BigInt(value);
}

function mapLead(lead: LeadRow): Task3Lead {
  if (!isTask3PipelineStatus(lead.pipeline_status)) {
    throw new Error(
      `Pipeline status trong DB không hợp lệ: ${lead.pipeline_status}`,
    );
  }
  const statusChangedAt = toDate(lead.status_changed_at);
  if (!statusChangedAt) {
    throw new Error("Lead thiếu thời điểm cập nhật Pipeline");
  }

  return {
    id: lead.id,
    version: lead.version,
    status: lead.pipeline_status,
    assignedTo: lead.assigned_sales_id,
    receivedBy: lead.received_by_user_id,
    receivedAt: toDate(lead.received_at),
    quoteSentAt: toDate(lead.first_quote_sent_at),
    respondedAt: toDate(lead.quote_responded_at),
    quoteValue: toSafeNumber(lead.quote_value),
    closedValue: toSafeNumber(lead.deal_value),
    closedAt: toDate(lead.closed_at),
    lostReason: lead.lost_reason,
    reopenCount: lead.reopen_count,
    statusChangedAt,
  };
}

function activityActionType(activity: Task3Activity): string {
  switch (activity.action) {
    case "STATUS_CHANGED":
      return "status_change";
    case "LEAD_REOPENED":
      return "reopen_lead";
    case "LEAD_RECEIVED":
      return "confirm_receive";
    case "LEAD_TRANSFERRED":
      return "reassign_sales";
    case "LEAD_UPDATED":
      return "update_info";
  }
}

function activityValue(value: string | null, field: string | null) {
  if (value === null || field === null) return null;
  const schemaField = {
    status: "pipelineStatus",
    assignedTo: "assignedSalesId",
    receivedAt: "receivedAt",
    quoteValue: "quoteValueVnd",
    closedValue: "dealValueVnd",
  }[field] ?? field;
  return JSON.stringify({ [schemaField]: value });
}

export class PrismaTask3Repository implements Task3Repository {
  constructor(
    private readonly client: typeof prisma = prisma,
    private readonly options: Task3PrismaRepositoryOptions = {},
  ) {}

  transaction<T>(
    work: (transaction: Task3Transaction) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (client) => {
      const options = this.options;
      const transaction: Task3Transaction = {
        async getLeadForUpdate(leadId) {
          const rows = await client.$queryRaw<LeadRow[]>(Prisma.sql`
            SELECT
              "id", "version", "pipeline_status", "lost_reason",
              "quote_value", "deal_value", "assigned_sales_id",
              "received_by_user_id", "received_at", "first_quote_sent_at",
              "quote_responded_at", "closed_at", "status_changed_at",
              "reopen_count"
            FROM "leads"
            WHERE "id" = ${leadId}
            LIMIT 1
          `);
          return rows[0] ? mapLead(rows[0]) : null;
        },
        async getTransferCandidateForUpdate(userId) {
          const users = await client.$queryRaw<
            Array<{ id: number; is_active: boolean; role_code: string }>
          >(Prisma.sql`
            SELECT u."id", u."is_active", r."role_code"
            FROM "users" AS u
            JOIN "roles" AS r ON r."id" = u."role_id"
            WHERE u."id" = ${userId} AND u."deleted_at" IS NULL
            LIMIT 1
          `);
          const user = users[0];
          if (!user) return null;

          if (!options.isUserOnline) {
            throw new Task3RepositoryConfigurationError(
              "Chưa cấu hình nguồn trạng thái online để chuyển giao Lead",
            );
          }

          const [counts, isOnline] = await Promise.all([
            client.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
              SELECT COUNT(*) AS "count"
              FROM "leads"
              WHERE "assigned_sales_id" = ${userId}
                AND "pipeline_status" NOT IN ('won', 'lost')
                AND "is_spam" = ${false}
            `),
            options.isUserOnline(userId, client),
          ]);
          const activeLeadCount = Number(counts[0]?.count ?? 0);
          if (!Number.isSafeInteger(activeLeadCount) || activeLeadCount < 0) {
            throw new Error("Số Lead đang xử lý của người nhận không hợp lệ");
          }

          return {
            id: user.id,
            isActive: user.is_active,
            isOnline,
            canReceiveLead: user.role_code === "SALES",
            activeLeadCount,
          };
        },
        async hasActiveFailureReason(lostReason) {
          if (!options.hasActiveFailureReason) {
            throw new Task3RepositoryConfigurationError(
              "Chưa cấu hình danh mục lý do thất bại",
            );
          }
          return options.hasActiveFailureReason(lostReason, client);
        },
        async updateLead(leadId, expectedVersion, changes) {
          const assignments: Prisma.Sql[] = [
            Prisma.sql`"version" = "version" + 1`,
            Prisma.sql`"updated_at" = CURRENT_TIMESTAMP`,
          ];
          if (changes.status !== undefined) {
            assignments.push(Prisma.sql`"pipeline_status" = ${changes.status}`);
          }
          if (changes.lostReason !== undefined) {
            assignments.push(Prisma.sql`"lost_reason" = ${changes.lostReason}`);
          }
          if (changes.assignedTo !== undefined) {
            assignments.push(
              Prisma.sql`"assigned_sales_id" = ${changes.assignedTo}`,
            );
          }
          if (changes.receivedBy !== undefined) {
            assignments.push(
              Prisma.sql`"received_by_user_id" = ${changes.receivedBy}`,
            );
          }
          if (changes.receivedAt !== undefined) {
            assignments.push(Prisma.sql`"received_at" = ${changes.receivedAt}`);
          }
          if (changes.quoteSentAt !== undefined) {
            assignments.push(
              Prisma.sql`"first_quote_sent_at" = ${changes.quoteSentAt}`,
            );
          }
          if (changes.respondedAt !== undefined) {
            assignments.push(
              Prisma.sql`"quote_responded_at" = ${changes.respondedAt}`,
            );
          }
          if (changes.quoteValue !== undefined) {
            assignments.push(
              Prisma.sql`"quote_value" = ${toSafeBigInt(changes.quoteValue)}`,
            );
          }
          if (changes.closedValue !== undefined) {
            assignments.push(
              Prisma.sql`"deal_value" = ${toSafeBigInt(changes.closedValue)}`,
            );
          }
          if (changes.closedAt !== undefined) {
            assignments.push(Prisma.sql`"closed_at" = ${changes.closedAt}`);
          }
          if (changes.statusChangedAt !== undefined) {
            assignments.push(
              Prisma.sql`"status_changed_at" = ${changes.statusChangedAt}`,
            );
          }
          if (changes.reopenCount !== undefined) {
            assignments.push(
              Prisma.sql`"reopen_count" = ${changes.reopenCount}`,
            );
          }

          const count = await client.$executeRaw(Prisma.sql`
            UPDATE "leads"
            SET ${Prisma.join(assignments)}
            WHERE "id" = ${leadId} AND "version" = ${expectedVersion}
          `);
          if (count !== 1) return null;

          const rows = await client.$queryRaw<LeadRow[]>(Prisma.sql`
            SELECT
              "id", "version", "pipeline_status", "lost_reason",
              "quote_value", "deal_value", "assigned_sales_id",
              "received_by_user_id", "received_at", "first_quote_sent_at",
              "quote_responded_at", "closed_at", "status_changed_at",
              "reopen_count"
            FROM "leads"
            WHERE "id" = ${leadId}
            LIMIT 1
          `);
          if (!rows[0]) {
            throw new Error("Lead biến mất sau cập nhật trong cùng transaction");
          }
          return mapLead(rows[0]);
        },
        async appendActivity(activity) {
          const statusChange = activity.field === "status";
          const isLostReason =
            activity.action === "STATUS_CHANGED" &&
            activity.newValue === "lost";
          await client.$executeRaw(Prisma.sql`
            INSERT INTO "lead_activities" (
              "lead_id", "action_type", "from_sales_id", "to_sales_id",
              "transfer_reason", "old_status", "new_status",
              "old_value_json", "new_value_json", "note",
              "action_by", "actor_type", "actor_ref", "created_at"
            ) VALUES (
              ${activity.leadId},
              ${activityActionType(activity)},
              ${activity.fromUserId},
              ${activity.toUserId},
              ${activity.action === "LEAD_TRANSFERRED" ? activity.reason : null},
              ${statusChange ? activity.oldValue : null},
              ${statusChange ? activity.newValue : null},
              ${activityValue(activity.oldValue, activity.field)},
              ${activityValue(activity.newValue, activity.field)},
              ${activity.note ??
                (isLostReason || activity.action === "LEAD_REOPENED"
                  ? activity.reason
                  : null)},
              ${activity.actorId},
              'user',
              ${`user:${activity.actorId}`},
              ${activity.createdAt}
            )
          `);
        },
      };
      return work(transaction);
    });
  }
}
