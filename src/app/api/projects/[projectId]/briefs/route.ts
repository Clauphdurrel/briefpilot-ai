import { readJsonBody, withProjectAccess, type ProjectRouteContext } from "@/server/http/interview";
import { generateBrief, listBriefs } from "@/server/services/brief.service";
import { generateBriefRequestSchema } from "@/server/validators/brief-generator.schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, context: ProjectRouteContext) {
  return withProjectAccess(request, context, (ownerId, projectId) => listBriefs(ownerId, projectId));
}
export async function POST(request: Request, context: ProjectRouteContext) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    const input = generateBriefRequestSchema.parse(await readJsonBody(request));
    return generateBrief(ownerId, projectId, input);
  });
}
