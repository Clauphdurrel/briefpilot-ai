import { withProjectAccess } from "@/server/http/interview";
import { pdfOperationKey, pdfQuery, pdfResponse } from "@/server/http/pdf-export";
import { generateBacklogPdf } from "@/server/exports/pdf/pdf.service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ projectId: string; backlogId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    pdfQuery(request);
    const operationId = pdfOperationKey(request), id = (await context.params).backlogId;
    return operationId ? generateBacklogPdf(ownerId, projectId, id, operationId) : generateBacklogPdf(ownerId, projectId, id);
  }, pdfResponse);
}
