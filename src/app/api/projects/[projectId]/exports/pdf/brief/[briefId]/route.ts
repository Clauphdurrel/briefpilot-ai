import { withProjectAccess } from "@/server/http/interview";
import { pdfOperationKey, pdfQuery, pdfResponse } from "@/server/http/pdf-export";
import { generateBriefPdf } from "@/server/exports/pdf/pdf.service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ projectId: string; briefId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    pdfQuery(request);
    const operationId = pdfOperationKey(request), id = (await context.params).briefId;
    return operationId ? generateBriefPdf(ownerId, projectId, id, operationId) : generateBriefPdf(ownerId, projectId, id);
  }, pdfResponse);
}
