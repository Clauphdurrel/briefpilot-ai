import "server-only";
import { z } from "zod";
import type { PdfExport } from "@/server/exports/pdf/pdf.service";
import { MAX_PDF_BYTES } from "@/server/exports/pdf/pdf-renderer";
import { projectIdSchema } from "@/server/validators/project.schema";
import { InterviewError } from "@/server/ai/errors";
export function pdfResponse(result: PdfExport): Response {
  const name = z.string().regex(/^[a-z0-9][a-z0-9-]{0,150}\.pdf$/).parse(result.filename);
  if (!result.content.length || result.content.length > MAX_PDF_BYTES || result.content.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF result");
  return new Response(new Uint8Array(result.content), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
export function pdfQuery(request: Request, project = false): { briefId?: string; backlogId?: string } {
  // PDF generation consumes quota even though download URLs use GET. Reject
  // cross-origin browser navigations before reserving usage or starting Chromium.
  // Clients without Fetch Metadata remain supported; their identity cannot be
  // distinguished from legacy browsers, so they still require a valid session.
  const site = request.headers.get("Sec-Fetch-Site");
  const origin = request.headers.get("Origin");
  const allowed = [new URL(request.url).origin];
  if (process.env.AUTH_URL) allowed.push(new URL(process.env.AUTH_URL).origin);
  if ((site !== null && !["same-origin", "none"].includes(site)) || (origin !== null && !allowed.includes(origin))) {
    throw new InterviewError("INVALID_ORIGIN", 403, "Origine du téléchargement invalide.");
  }
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) throw new z.ZodError([]);
  return (project ? z.strictObject({ briefId: projectIdSchema, backlogId: projectIdSchema.optional() }) : z.strictObject({})).parse(Object.fromEntries(params));
}

export function pdfOperationKey(request: Request): string | undefined {
  const value = request.headers.get("Idempotency-Key");
  return value === null ? undefined : z.uuid().parse(value);
}
