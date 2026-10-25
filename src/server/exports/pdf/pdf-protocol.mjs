import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const PDF_TIMEOUT_MS = 35000;
export const WORKER_TIMEOUT_MS = 40000;
export const MAX_WORKER_REQUEST_BYTES = 6 * MAX_HTML_BYTES + 1024;
export const workerInput = z.strictObject({ html: z.string().min(1).refine(value => Buffer.byteLength(value) <= MAX_HTML_BYTES), owner: z.string().regex(/^[a-f0-9]{64}$/) });
export class PdfRuntimeError extends Error {
  constructor(code, status, message = "PDF service unavailable") { super(message); this.code = code; this.status = status; }
}
export const secretSchema = z.string().min(32).max(256);
// Optional project-scoped Vercel automation token, separate from worker HMAC.
// Never use the application's own VERCEL_AUTOMATION_BYPASS_SECRET here.
/** @param {string | undefined} value
 * @returns {Record<string, string>} */
export function workerProtectionHeaders(value) {
  if (!value) return {};
  if (!z.string().min(32).max(256).regex(/^[\x21-\x7e]+$/).safeParse(value).success) throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
  return { "x-vercel-protection-bypass": value };
}
export function sameSecret(actual, expected) {
  return typeof actual === "string" && timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}
export function signature(body, secret, timestamp, nonce) {
  const digest = createHash("sha256").update(body).digest("hex");
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${digest}`).digest("hex");
}
export function workerHeaders(body, secret, now = Date.now(), nonce = randomUUID()) {
  const timestamp = String(now);
  return { "Content-Type": "application/json", Authorization: `Bearer ${secret}`, "X-PDF-Timestamp": timestamp, "X-PDF-Nonce": nonce, "X-PDF-Signature": signature(body, secret, timestamp, nonce) };
}
export function validSignature(body, secret, headers, now = Date.now()) {
  const timestamp = headers["x-pdf-timestamp"], nonce = headers["x-pdf-nonce"], mac = headers["x-pdf-signature"];
  if (typeof timestamp !== "string" || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 60000 ||
      typeof nonce !== "string" || !z.uuid().safeParse(nonce).success || typeof mac !== "string" || !/^[a-f0-9]{64}$/.test(mac)) return false;
  return sameSecret(mac, signature(body, secret, timestamp, nonce));
}
export async function readLimited(stream, maxBytes) {
  if (!stream) throw new PdfRuntimeError("INVALID_REQUEST", 400);
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    const data = Buffer.from(chunk); size += data.length;
    if (size > maxBytes) throw new PdfRuntimeError("PDF_TOO_LARGE", 422);
    chunks.push(data);
  }
  return Buffer.concat(chunks);
}
