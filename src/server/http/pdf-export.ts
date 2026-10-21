import "server-only";
import { z } from "zod";
import type { PdfExport } from "@/server/exports/pdf/pdf.service";
import { MAX_PDF_BYTES } from "@/server/exports/pdf/pdf-renderer";
import { projectIdSchema } from "@/server/validators/project.schema";
export function pdfResponse(result: PdfExport): Response {
  const name = z.string().regex(/^[a-z0-9][a-z0-9-]{0,150}\.pdf$/).parse(result.filename);
  if (!result.content.length || result.content.length > MAX_PDF_BYTES || result.content.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF result");
  return new Response(new Uint8Array(result.content), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
export function pdfQuery(request: Request, project = false): { briefId?: string; backlogId?: string } {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) throw new z.ZodError([]);
  return (project ? z.strictObject({ briefId: projectIdSchema, backlogId: projectIdSchema.optional() }) : z.strictObject({})).parse(Object.fromEntries(params));
}

export function pdfOperationKey(request: Request): string | undefined {
  const value = request.headers.get("Idempotency-Key");
  return value === null ? undefined : z.uuid().parse(value);
}
