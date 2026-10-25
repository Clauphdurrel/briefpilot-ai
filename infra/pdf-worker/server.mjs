import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pino from "pino";
import { renderPdfLocal } from "../../src/server/exports/pdf/pdf-engine.mjs";
import { workerInput, secretSchema, PdfRuntimeError, sameSecret, validSignature, MAX_WORKER_REQUEST_BYTES, readLimited } from "../../src/server/exports/pdf/pdf-protocol.mjs";

export function createPdfWorker({ secret, render = renderPdfLocal, log = pino({ base: undefined }), now = Date.now } = {}) {
  secretSchema.parse(secret);
  const seen = new Map(); let closing = false;
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 5000, headersTimeout: 5000, connectionsCheckingInterval: 1000 }, async (request, response) => {
    const started = now(), requestId = randomUUID(); let status = 500;
    response.setHeader("Cache-Control", "no-store"); response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (closing) throw new PdfRuntimeError("PDF_UNAVAILABLE", 503);
      if (request.method === "GET" && request.url === "/health") { status = 200; response.setHeader("Content-Type", "application/json"); response.end('{"status":"ok"}'); return; }
      if (request.method !== "POST" || request.url !== "/render") throw new PdfRuntimeError("NOT_FOUND", 404);
      if (!sameSecret(request.headers.authorization, `Bearer ${secret}`)) throw new PdfRuntimeError("UNAUTHENTICATED", 401);
      if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") throw new PdfRuntimeError("INVALID_REQUEST", 400);
      const length = request.headers["content-length"];
      if (length && (!/^\d+$/.test(length) || Number(length) > MAX_WORKER_REQUEST_BYTES)) throw new PdfRuntimeError("PDF_TOO_LARGE", 422);
      const body = await readLimited(request, MAX_WORKER_REQUEST_BYTES);
      if (!validSignature(body, secret, request.headers, now())) throw new PdfRuntimeError("UNAUTHENTICATED", 401);
      for (const [nonce, expires] of seen) if (expires < now()) seen.delete(nonce);
      const nonce = request.headers["x-pdf-nonce"];
      if (seen.has(nonce)) throw new PdfRuntimeError("REPLAY_REJECTED", 409);
      if (seen.size >= 10000) throw new PdfRuntimeError("PDF_BUSY", 429);
      const input = workerInput.safeParse(JSON.parse(body.toString("utf8")));
      if (!input.success) throw new PdfRuntimeError("INVALID_REQUEST", 400);
      seen.set(nonce, now() + 180000);
      const pdf = await render(input.data.html, input.data.owner);
      status = 200; response.setHeader("Content-Type", "application/pdf"); response.end(pdf);
    } catch (error) {
      const known = error instanceof PdfRuntimeError ? error : new PdfRuntimeError(error instanceof SyntaxError ? "INVALID_REQUEST" : "PDF_UNAVAILABLE", error instanceof SyntaxError ? 400 : 503);
      status = known.status;
      if (!response.destroyed && !response.headersSent) { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify({ code: known.code })); }
    } finally { log.info({ event: "pdf_worker_request", requestId, statusCode: status, durationMs: Math.max(0, now() - started) }); }
  });
  server.maxConnections = 32; server.keepAliveTimeout = 5000;
  return { server, close: () => { closing = true; return new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); }); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const secret = process.env.PDF_WORKER_SECRET_FILE ? readFileSync(process.env.PDF_WORKER_SECRET_FILE, "utf8").trim() : process.env.PDF_WORKER_SECRET;
    const port = Number(process.env.PORT ?? 8080);
    const shutdown = Number(process.env.PDF_WORKER_SHUTDOWN_MS ?? 40000);
    if (!Number.isInteger(shutdown) || shutdown < 1000 || shutdown > 40000) throw new Error("Invalid shutdown timeout");
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
    const worker = createPdfWorker({ secret });
    worker.server.listen(port, "0.0.0.0");
    for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, async () => {
      const deadline = setTimeout(() => process.exit(1), shutdown).unref();
      await worker.close(); clearTimeout(deadline);
    });
  } catch { process.stderr.write('{"event":"pdf_worker_configuration_error"}\n'); process.exitCode = 1; }
}
