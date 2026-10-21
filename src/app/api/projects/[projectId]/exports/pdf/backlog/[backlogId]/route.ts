import { withProjectAccess } from "@/server/http/interview";
import { pdfQuery, pdfResponse } from "@/server/http/pdf-export";
import { generateBacklogPdf } from "@/server/exports/pdf/pdf.service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ projectId: string; backlogId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    pdfQuery(request);
    return generateBacklogPdf(ownerId, projectId, (await context.params).backlogId);
  }, pdfResponse);
}
