import {
  hasBaPermission,
  Task3LeadIdParamsSchema,
  Task3LeadResponseSchema,
  type Task3LeadResponseDto,
  type RoleCode,
} from "@toantrung/contracts";
import {
  jsonError,
  jsonSuccess,
} from "../../core/http/index.ts";
import { requireAuthenticatedSession } from "../../core/permissions/index.ts";
import { createTask3LeadAuthorizer } from "./task3-authorization.ts";
import type {
  Task3Lead,
  Task3Result,
} from "./task3-contracts.ts";
import { PrismaTask3Repository, Task3RepositoryConfigurationError } from "./task3-prisma-repository.ts";
import type { Task3Repository } from "./task3-repository.ts";

export type Task3RepositoryFactory = () => Task3Repository;

function serializeLead(lead: Task3Lead): Task3LeadResponseDto {
  const response = {
    id: lead.id,
    version: lead.version,
    pipelineStatus: lead.status,
    assignedSalesId: lead.assignedTo,
    receivedByUserId: lead.receivedBy,
    receivedAt: lead.receivedAt?.toISOString() ?? null,
    firstQuoteSentAt: lead.quoteSentAt?.toISOString() ?? null,
    quoteRespondedAt: lead.respondedAt?.toISOString() ?? null,
    quoteValueVnd: lead.quoteValue,
    dealValueVnd: lead.closedValue,
    closedAt: lead.closedAt?.toISOString() ?? null,
    statusChangedAt: lead.statusChangedAt.toISOString(),
    lostReason: lead.lostReason,
    reopenCount: lead.reopenCount,
  };
  const parsed = Task3LeadResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error("Task 3 response does not match the public contract");
  }
  return parsed.data;
}

function resultError(error: string) {
  if (error === "Không tìm thấy Lead") {
    return jsonError("LEAD_NOT_FOUND", error, 404);
  }
  if (error.includes("được cập nhật bởi thao tác khác")) {
    return jsonError("LEAD_VERSION_CONFLICT", error, 409);
  }
  if (
    error.includes("Không có quyền") ||
    error.includes("Chỉ người được giao")
  ) {
    return jsonError("FORBIDDEN", error, 403);
  }
  if (error.startsWith("Chưa cấu hình")) {
    return jsonError("TASK3_NOT_CONFIGURED", error, 503);
  }
  return jsonError("TASK3_VALIDATION_ERROR", error, 400);
}

export async function runTask3Mutation<TBody>(
  request: Request,
  rawLeadId: string,
  schema: {
    safeParse(value: unknown):
      | { success: true; data: TBody }
      | { success: false; error: { issues: Array<{ message: string }> } };
  },
  operation: (
    repository: Task3Repository,
    leadId: number,
    actorId: number,
    authorize: ReturnType<typeof createTask3LeadAuthorizer>,
    body: TBody,
  ) => Promise<Task3Result<Task3Lead>>,
  repositoryFactory: Task3RepositoryFactory = () =>
    new PrismaTask3Repository(),
) {
  const auth = await requireAuthenticatedSession(request);
  if (!auth.ok) return auth.response;

  const idResult = Task3LeadIdParamsSchema.safeParse({ id: rawLeadId });
  if (!idResult.success) {
    return jsonError("INVALID_LEAD_ID", "Mã Lead không hợp lệ.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Dữ liệu gửi lên không hợp lệ.", 400);
  }
  const parsedBody = schema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(
      "VALIDATION_ERROR",
      parsedBody.error.issues[0]?.message ?? "Dữ liệu Task 3 không hợp lệ.",
      400,
    );
  }

  const actor = auth.user;
  const authorize = createTask3LeadAuthorizer(
    { id: actor.id, roleCode: actor.roleCode },
    hasBaPermission,
  );
  try {
    const result = await operation(
      repositoryFactory(),
      idResult.data.id,
      actor.id,
      authorize,
      parsedBody.data,
    );
    if (!result.success) return resultError(result.error);
    return jsonSuccess(serializeLead(result.value));
  } catch (error) {
    if (error instanceof Task3RepositoryConfigurationError) {
      return jsonError("TASK3_NOT_CONFIGURED", error.message, 503);
    }
    throw error;
  }
}
