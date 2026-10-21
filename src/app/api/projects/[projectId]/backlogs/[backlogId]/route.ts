import { withProjectAccess } from "@/server/http/interview";
import { getBacklogById } from "@/server/services/backlog.service";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ projectId: string; backlogId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => getBacklogById(ownerId, projectId, (await context.params).backlogId));
}
