import { readInterviewBody, withInterviewAccess, type ProjectRouteContext } from "@/server/http/interview";
import { advanceInterview, getInterview } from "@/server/services/interview.service";
import { startInterviewSchema } from "@/server/validators/interview-agent.schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, context: ProjectRouteContext) {
  return withInterviewAccess(request, context, (ownerId, projectId) => getInterview(ownerId, projectId));
}

export async function POST(request: Request, context: ProjectRouteContext) {
  return withInterviewAccess(request, context, async (ownerId, projectId) => {
    const input = startInterviewSchema.parse(await readInterviewBody(request));
    return advanceInterview(ownerId, projectId, input, "start");
  });
}
