import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chromium } from "playwright";
import { renderPdf, MAX_HTML_BYTES, MAX_PDF_BYTES, PDF_TIMEOUT_MS } from "../pdf-renderer";
vi.mock("playwright", () => ({ chromium: { launch: vi.fn() } }));
const pdf = vi.fn(), setContent = vi.fn(), route = vi.fn(), newContext = vi.fn(), close = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  pdf.mockResolvedValue(Buffer.from("%PDF-1.7 test"));
  newContext.mockResolvedValue({ route, newPage: vi.fn().mockResolvedValue({ setDefaultTimeout: vi.fn(), setContent, emulateMedia: vi.fn(), pdf }) });
  vi.mocked(chromium.launch).mockResolvedValue({ newContext, close } as never);
});
afterEach(() => { vi.useRealTimers(); });
it("uses sandbox, no application env, offline context, disabled JS, blocked routes and A4 pagination", async () => {
  vi.stubEnv("OPENAI_API_KEY", "private-secret");
  try {
    await renderPdf("<p>Évry</p>", "owner");
    const launch = vi.mocked(chromium.launch).mock.calls[0][0]!;
    expect(launch.chromiumSandbox).toBe(true); expect(launch.env).not.toHaveProperty("OPENAI_API_KEY"); expect(launch.args ?? []).not.toContain("--no-sandbox");
    expect(newContext).toHaveBeenCalledWith(expect.objectContaining({ javaScriptEnabled: false, offline: true, serviceWorkers: "block" }));
    const abort = vi.fn(); await route.mock.calls[0][1]({ abort }); expect(abort).toHaveBeenCalled();
    expect(pdf).toHaveBeenCalledWith(expect.objectContaining({ format: "A4", printBackground: true, displayHeaderFooter: true, footerTemplate: expect.stringContaining('class="totalPages"') }));
    expect(close).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllEnvs(); }
});
it.each(["content", "pdf", "context"])("closes browser and sanitizes errors from %s", async (stage) => {
  (stage === "content" ? setContent : stage === "pdf" ? pdf : newContext).mockRejectedValueOnce(new Error("private-machine-detail"));
  await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_UNAVAILABLE", status: 503 });
  expect(close).toHaveBeenCalledTimes(1);
  await expect(renderPdf("x", "owner")).resolves.toBeInstanceOf(Buffer);
});
it("rejects launch failure safely and releases the slot", async () => {
  vi.mocked(chromium.launch).mockRejectedValueOnce(new Error("secret-path"));
  await expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_UNAVAILABLE" });
  await expect(renderPdf("x", "owner")).resolves.toBeInstanceOf(Buffer);
});
it("enforces input/output limits", async () => {
  await expect(renderPdf("x".repeat(MAX_HTML_BYTES + 1), "owner")).rejects.toMatchObject({ status: 422 });
  expect(chromium.launch).not.toHaveBeenCalled();
  pdf.mockResolvedValueOnce(Buffer.alloc(MAX_PDF_BYTES + 1));
  await expect(renderPdf("x", "owner")).rejects.toMatchObject({ status: 422 }); expect(close).toHaveBeenCalled();
});
it("times out stalled rendering and closes Chromium", async () => {
  vi.useFakeTimers(); pdf.mockReturnValueOnce(new Promise(() => {}));
  const assertion = expect(renderPdf("x", "owner")).rejects.toMatchObject({ code: "PDF_TIMEOUT", status: 503 });
  await vi.advanceTimersByTimeAsync(PDF_TIMEOUT_MS + 1); await assertion;
  expect(close).toHaveBeenCalledTimes(1);
});
it("allows at most two renders per process and one per owner without a queue", async () => {
  let release!: (data: Buffer) => void;
  const blocked = new Promise<Buffer>((resolve) => { release = resolve; }); pdf.mockReturnValue(blocked);
  const a = renderPdf("x", "owner1"), b = renderPdf("x", "owner2");
  await expect(renderPdf("x", "owner1")).rejects.toMatchObject({ status: 429 });
  await expect(renderPdf("x", "owner3")).rejects.toMatchObject({ status: 429 });
  release(Buffer.from("%PDF-test")); await Promise.all([a, b]);
  await expect(renderPdf("x", "owner3")).resolves.toBeInstanceOf(Buffer);
});
