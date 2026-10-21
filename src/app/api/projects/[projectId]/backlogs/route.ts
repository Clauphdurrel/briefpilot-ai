import { readJsonBody, withProjectAccess, type ProjectRouteContext } from "@/server/http/interview";
import { generateBacklog, getProjectBacklogs } from "@/server/services/backlog.service";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: ProjectRouteContext) {
  return withProjectAccess(request, context, (ownerId, projectId) => getProjectBacklogs(ownerId, projectId));
}
export async function POST(request: Request, context: ProjectRouteContext) {
  return withProjectAccess(request, context, async (ownerId, projectId) => generateBacklog(ownerId, projectId, await readJsonBody(request)));
}
