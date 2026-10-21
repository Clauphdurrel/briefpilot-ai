import { withProjectAccess } from "@/server/http/interview";
import { pdfOperationKey, pdfQuery, pdfResponse } from "@/server/http/pdf-export";
import { generateProjectPdf } from "@/server/exports/pdf/pdf.service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    const query = pdfQuery(request, true);
    const operationId = pdfOperationKey(request);
    return operationId ? generateProjectPdf(ownerId, projectId, query.briefId!, query.backlogId, operationId) : generateProjectPdf(ownerId, projectId, query.briefId!, query.backlogId);
  }, pdfResponse);
}
