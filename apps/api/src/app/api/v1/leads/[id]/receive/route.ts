import {
  Task3ReceptionRequestSchema,
  type Task3ReceptionRequestDto,
} from "@toantrung/contracts";
import { runTask3Mutation } from "../../../../../../modules/01-leads/task3-http.ts";
import { confirmTask3Reception } from "../../../../../../modules/01-leads/task3-workflow.ts";

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  return runTask3Mutation(
    request,
    params.id,
    Task3ReceptionRequestSchema,
    (repository, leadId, actorId, authorize, body: Task3ReceptionRequestDto) =>
      confirmTask3Reception(
        repository,
        {
          leadId,
          actorId,
          expectedVersion: body.expectedVersion,
          now: new Date(),
        },
        authorize,
      ),
  );
}
