import {
  Task3TransferRequestSchema,
  type Task3TransferRequestDto,
} from "@toantrung/contracts";
import { runTask3Mutation } from "../../../../../../modules/01-leads/task3-http.ts";
import { transferTask3Lead } from "../../../../../../modules/01-leads/task3-workflow.ts";

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  return runTask3Mutation(
    request,
    params.id,
    Task3TransferRequestSchema,
    (repository, leadId, actorId, authorize, body: Task3TransferRequestDto) =>
      transferTask3Lead(
        repository,
        {
          leadId,
          actorId,
          expectedVersion: body.expectedVersion,
          receiverId: body.receiverId,
          reason: body.reason,
          note: body.note,
          now: new Date(),
        },
        authorize,
      ),
  );
}
