import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderPdf } from "../pdf-renderer";
import { workerConfig } from "../pdf-worker-client";
import { validSignature } from "../pdf-protocol.mjs";
const network = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", network); network.mockReset();
  vi.stubEnv("PDF_RENDER_MODE", "worker"); vi.stubEnv("PDF_WORKER_URL", "https://pdf.example.invalid");
  vi.stubEnv("PDF_WORKER_SECRET", "synthetic-pdf-secret-at-least-32-characters"); vi.stubEnv("APP_ENV", "staging");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("signs server-generated HTML with an opaque owner and accepts only a bounded PDF", async () => {
  network.mockResolvedValue(new Response("%PDF-1.7 synthetic", { headers: { "content-type": "application/pdf" } }));
  expect((await renderPdf("<p>Document</p>", "PRIVATE_OWNER")).toString()).toContain("%PDF-");
  const [url, init] = network.mock.calls[0];
  expect(String(url)).toBe("https://pdf.example.invalid/render"); expect(init.redirect).toBe("error");
  expect(JSON.parse(init.body).owner).toMatch(/^[a-f0-9]{64}$/); expect(init.body).not.toContain("PRIVATE_OWNER");
  expect(validSignature(Buffer.from(init.body), process.env.PDF_WORKER_SECRET, Object.fromEntries(Object.entries(init.headers).map(([key, value]) => [key.toLowerCase(), value])))).toBe(true);
});
it.each(["http://pdf.example.invalid", "https://user:pass@pdf.example.invalid", "https://pdf.example.invalid/?secret=x", "https://pdf.example.invalid/path"])("refuses unsafe configuration %s before networking", async (url) => {
  vi.stubEnv("PDF_WORKER_URL", url); await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_UNAVAILABLE" }); expect(network).not.toHaveBeenCalled();
});
it("allows loopback HTTP exclusively outside staging, production and Vercel", () => {
  vi.stubEnv("PDF_WORKER_URL", "http://127.0.0.1:3193"); expect(() => workerConfig()).toThrow();
  vi.stubEnv("APP_ENV", "development"); expect(workerConfig().url.protocol).toBe("http:");
  vi.stubEnv("VERCEL", "1"); expect(() => workerConfig()).toThrow();
});
it("never falls back to local Chromium on Vercel", async () => {
  vi.stubEnv("VERCEL", "1"); vi.stubEnv("PDF_RENDER_MODE", "local");
  await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_UNAVAILABLE" }); expect(network).not.toHaveBeenCalled();
});
it.each([[429, "PDF_BUSY"], [422, "PDF_TOO_LARGE"], [503, "PDF_TIMEOUT"], [401, "PRIVATE_WORKER_SECRET"]])("sanitizes worker error %s", async (status, code) => {
  network.mockResolvedValue(new Response(JSON.stringify({ code, message: "PRIVATE" }), { status }));
  const expected = ["PDF_BUSY", "PDF_TOO_LARGE", "PDF_TIMEOUT"].includes(code) ? code : "PDF_UNAVAILABLE";
  await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: expected });
});
it.each([new Response("not PDF", { headers: { "Content-Type": "application/pdf" } }), new Response("%PDF-x", { headers: { "Content-Type": "text/html" } })])("refuses invalid worker output", async response => {
  network.mockResolvedValue(response); await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_UNAVAILABLE" });
});
it("enforces the Vercel download bound before quota commit", async () => {
  vi.stubEnv("VERCEL", "1"); network.mockResolvedValue(new Response(Buffer.alloc(4 * 1024 * 1024 + 1), { headers: { "Content-Type": "application/pdf" } }));
  await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_TOO_LARGE", status: 422 });
});
it("sanitizes network errors without leaking internal worker addresses", async () => {
  network.mockRejectedValue(new Error("PRIVATE_URL_TOKEN"));
  await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_UNAVAILABLE", message: expect.not.stringContaining("PRIVATE") });
});
it("maps an aborted transport deadline to a sanitized PDF timeout", async () => {
  const aborted = AbortSignal.abort(new DOMException("PRIVATE transport", "TimeoutError"));
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(aborted);
  network.mockRejectedValue(new DOMException("PRIVATE transport", "TimeoutError"));
  try {
    await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_TIMEOUT", status: 503 });
    expect(timeout).toHaveBeenCalledWith(40000);
  } finally { timeout.mockRestore(); }
});
