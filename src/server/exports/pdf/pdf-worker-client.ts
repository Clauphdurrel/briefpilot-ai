import "server-only";
import { createHmac } from "node:crypto";
import { MAX_PDF_BYTES, WORKER_TIMEOUT_MS, PdfRuntimeError, readLimited, secretSchema, workerHeaders, workerProtectionHeaders } from "./pdf-protocol.mjs";

export function workerConfig() {
  const secret = secretSchema.safeParse(process.env.PDF_WORKER_SECRET);
  let url: URL;
  try { url = new URL(process.env.PDF_WORKER_URL ?? ""); } catch { throw new PdfRuntimeError("PDF_UNAVAILABLE", 503); }
  const local = process.env.APP_ENV !== "staging" && process.env.APP_ENV !== "production" && process.env.VERCEL !== "1" &&
    url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!secret.success || (!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
  const protectionHeaders = workerProtectionHeaders(process.env.PDF_WORKER_VERCEL_BYPASS_SECRET);
  if (Object.keys(protectionHeaders).length && url.protocol !== "https:") throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
  return { secret: secret.data, url: new URL("/render", url), protectionHeaders };
}
export async function renderWithWorker(html: string, ownerId: string): Promise<Buffer> {
  const { secret, url, protectionHeaders } = workerConfig();
  const owner = createHmac("sha256", secret).update(ownerId).digest("hex");
  const body = JSON.stringify({ html, owner });
  if (process.env.VERCEL === "1" && Buffer.byteLength(body) > 4 * 1024 * 1024) throw new PdfRuntimeError("PDF_TOO_LARGE", 422);
  const signal = AbortSignal.timeout(WORKER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "POST", redirect: "error", cache: "no-store", signal, headers: { ...workerHeaders(body, secret), ...protectionHeaders }, body });
    if (!response.ok) {
      const error = JSON.parse((await readLimited(response.body, 2048)).toString("utf8"));
      if (response.status === 429 && error.code === "PDF_BUSY") throw new PdfRuntimeError("PDF_BUSY", 429);
      if (response.status === 422 && error.code === "PDF_TOO_LARGE") throw new PdfRuntimeError("PDF_TOO_LARGE", 422);
      if (error.code === "PDF_TIMEOUT") throw new PdfRuntimeError("PDF_TIMEOUT", 503);
      throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
    }
    if (response.headers.get("content-type")?.split(";", 1)[0] !== "application/pdf") throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
    const max = process.env.VERCEL === "1" ? 4 * 1024 * 1024 : MAX_PDF_BYTES;
    const result = await readLimited(response.body, max);
    if (!result.length || result.subarray(0, 5).toString() !== "%PDF-") throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
    return result;
  } catch (error) {
    if (error instanceof PdfRuntimeError) throw error;
    throw new PdfRuntimeError(signal.aborted ? "PDF_TIMEOUT" : "PDF_UNAVAILABLE", 503);
  }
}
