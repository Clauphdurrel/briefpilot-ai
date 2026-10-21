import { withProjectAccess } from "@/server/http/interview";
import { markdownResponse, parseExportQuery } from "@/server/http/markdown-export";
import { exportBriefMarkdown } from "@/server/exports/export.service";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ projectId: string; briefId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    parseExportQuery(request, "brief");
    return exportBriefMarkdown(ownerId, projectId, (await context.params).briefId);
  }, markdownResponse);
}
