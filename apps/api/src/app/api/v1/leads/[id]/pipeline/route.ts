import {
  Task3PipelineRequestSchema,
  type Task3PipelineRequestDto,
} from "@toantrung/contracts";
import { runTask3Mutation } from "../../../../../../modules/01-leads/task3-http.ts";
import { transitionTask3Lead } from "../../../../../../modules/01-leads/task3-workflow.ts";

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  return runTask3Mutation(
    request,
    params.id,
    Task3PipelineRequestSchema,
    (repository, leadId, actorId, authorize, body: Task3PipelineRequestDto) =>
      transitionTask3Lead(
        repository,
        {
          leadId,
          actorId,
          expectedVersion: body.expectedVersion,
          nextStatus: body.nextStatus,
          lostReason: body.lostReason,
          quoteValue: body.quoteValueVnd,
          closedValue: body.dealValueVnd,
          now: new Date(),
        },
        authorize,
      ),
  );
}
