import { withProjectAccess } from "@/server/http/interview";
import { pdfQuery, pdfResponse } from "@/server/http/pdf-export";
import { generateProjectPdf } from "@/server/exports/pdf/pdf.service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    const query = pdfQuery(request, true);
    return generateProjectPdf(ownerId, projectId, query.briefId!, query.backlogId);
  }, pdfResponse);
}
