import { readInterviewBody, withInterviewAccess, type ProjectRouteContext } from "@/server/http/interview";
import { advanceInterview } from "@/server/services/interview.service";
import { sendInterviewMessageSchema } from "@/server/validators/interview-agent.schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: ProjectRouteContext) {
  return withInterviewAccess(request, context, async (ownerId, projectId) => {
    const input = sendInterviewMessageSchema.parse(await readInterviewBody(request));
    return advanceInterview(ownerId, projectId, input, "message");
  });
}
