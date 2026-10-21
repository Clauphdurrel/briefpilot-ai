import { withProjectAccess } from "@/server/http/interview";
import { markdownResponse, parseExportQuery } from "@/server/http/markdown-export";
import { exportBacklogMarkdown, exportCodexTasksMarkdown } from "@/server/exports/export.service";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ projectId: string; backlogId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    const query = parseExportQuery(request, "backlog");
    const id = (await context.params).backlogId;
    return query.format === "codex-tasks" ? exportCodexTasksMarkdown(ownerId, projectId, id) : exportBacklogMarkdown(ownerId, projectId, id);
  }, markdownResponse);
}
