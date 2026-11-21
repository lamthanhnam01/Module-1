import {
  Task3ReopenRequestSchema,
  type Task3ReopenRequestDto,
} from "@toantrung/contracts";
import { runTask3Mutation } from "../../../../../../modules/01-leads/task3-http.ts";
import { reopenTask3Lead } from "../../../../../../modules/01-leads/task3-workflow.ts";

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  return runTask3Mutation(
    request,
    params.id,
    Task3ReopenRequestSchema,
    (repository, leadId, actorId, authorize, body: Task3ReopenRequestDto) => {
      const configuredWindow = process.env.TASK3_REOPEN_WINDOW_MS;
      if (!configuredWindow || !/^\d+$/.test(configuredWindow)) {
        return Promise.resolve({
          success: false as const,
          error: "Chưa cấu hình thời hạn mở lại Lead",
        });
      }
      const reopenWindowMs = Number(configuredWindow);
      if (!Number.isSafeInteger(reopenWindowMs)) {
        return Promise.resolve({
          success: false as const,
          error: "Chưa cấu hình thời hạn mở lại Lead",
        });
      }

      return reopenTask3Lead(
        repository,
        {
          leadId,
          actorId,
          expectedVersion: body.expectedVersion,
          nextStatus: body.nextStatus,
          reason: body.reason,
          reopenWindowMs,
          now: new Date(),
        },
        authorize,
      );
    },
  );
}
