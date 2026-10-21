import { withProjectAccess } from "@/server/http/interview";
import { getBrief } from "@/server/services/brief.service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ projectId: string; briefId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => getBrief(ownerId, projectId, (await context.params).briefId));
}
