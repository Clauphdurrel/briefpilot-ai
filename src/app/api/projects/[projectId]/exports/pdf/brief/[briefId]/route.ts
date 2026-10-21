import { withProjectAccess } from "@/server/http/interview";
import { pdfQuery, pdfResponse } from "@/server/http/pdf-export";
import { generateBriefPdf } from "@/server/exports/pdf/pdf.service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ projectId: string; briefId: string }> }) {
  return withProjectAccess(request, context, async (ownerId, projectId) => {
    pdfQuery(request);
    return generateBriefPdf(ownerId, projectId, (await context.params).briefId);
  }, pdfResponse);
}
