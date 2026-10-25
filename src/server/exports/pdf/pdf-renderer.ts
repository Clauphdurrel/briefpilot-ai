import "server-only";
import { InterviewError } from "@/server/ai/errors";
import { MAX_HTML_BYTES, PdfRuntimeError } from "./pdf-protocol.mjs";
import { renderWithWorker } from "./pdf-worker-client";
export { MAX_PDF_BYTES, MAX_HTML_BYTES, PDF_TIMEOUT_MS } from "./pdf-protocol.mjs";

/** The same safe rendering engine runs locally or in an authenticated worker. */
export async function renderPdf(html: string, ownerId: string): Promise<Buffer> {
  if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw new InterviewError("PDF_TOO_LARGE", 422, "Ce document est trop volumineux pour l’export PDF.");
  const mode = process.env.PDF_RENDER_MODE ?? (process.env.VERCEL === "1" ? "worker" : "local");
  try {
    if (mode === "worker") return await renderWithWorker(html, ownerId);
    if (mode !== "local" || process.env.VERCEL === "1") throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
    const { renderPdfLocal } = await import("./pdf-engine.mjs");
    return await renderPdfLocal(html, ownerId);
  } catch (error) {
    const code = error instanceof PdfRuntimeError ? error.code : "PDF_UNAVAILABLE";
    const messages: Record<string, string> = {
      PDF_BUSY: "Un export PDF est déjà en cours. Réessaie dans quelques instants.",
      PDF_TOO_LARGE: process.env.VERCEL === "1" ? "Ce document dépasse la limite de téléchargement de 4 Mo sur cet hébergement." : "Ce document dépasse la limite de téléchargement de 8 Mo.",
      PDF_TIMEOUT: "La préparation du PDF a expiré. Réessaie.",
      PDF_UNAVAILABLE: "La préparation du PDF est momentanément indisponible. Réessaie.",
    };
    throw new InterviewError(Object.hasOwn(messages, code) ? code : "PDF_UNAVAILABLE", code === "PDF_BUSY" ? 429 : code === "PDF_TOO_LARGE" ? 422 : 503, messages[code] ?? messages.PDF_UNAVAILABLE);
  }
}
