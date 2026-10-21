import "server-only";
import { chromium, type Browser } from "playwright";
import { InterviewError } from "@/server/ai/errors";

export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const PDF_TIMEOUT_MS = 35000;
// Shared by the different route bundles within one Node process. No waiting queue.
const state = globalThis as unknown as { briefpilotPdfSlots?: Set<string> };
const slots = state.briefpilotPdfSlots ??= new Set<string>();
export async function renderPdf(html: string, ownerId: string): Promise<Buffer> {
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) throw new InterviewError("PDF_TOO_LARGE", 422, "Ce document est trop volumineux pour l’export PDF.");
  if (slots.size >= 2 || slots.has(ownerId)) throw new InterviewError("PDF_BUSY", 429, "Un export PDF est déjà en cours. Réessaie dans quelques instants.");
  slots.add(ownerId);
  let browser: Browser | undefined, expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = async () => {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true, timeout: 12000,
      executablePath: process.env.PDF_CHROMIUM_EXECUTABLE_PATH || undefined,
      // Application credentials are never inherited by Chromium.
      env: Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "XDG_CACHE_HOME"].flatMap((key) => process.env[key] ? [[key, process.env[key]!]] : [])),
    });
    if (expired) { await browser.close(); throw new Error("PDF deadline exceeded"); }
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", offline: true, acceptDownloads: false });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.setContent(html, { waitUntil: "load", timeout: 10000 });
    await page.emulateMedia({ media: "print" });
    return page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true,
      margin: { top: "20mm", bottom: "21mm", left: "17mm", right: "17mm" }, displayHeaderFooter: true,
      headerTemplate: '<div style="font:8px Arial;color:#60727b;width:100%;margin:0 17mm">BRIEFPILOT AI · Document de travail</div>',
      footerTemplate: '<div style="font:9px Arial;color:#60727b;width:100%;margin:0 17mm;text-align:right">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
  };
  try {
    const result = await Promise.race([work(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error("PDF deadline exceeded")); }, PDF_TIMEOUT_MS);
    })]);
    if (!result.length || result.length > MAX_PDF_BYTES) throw new InterviewError("PDF_TOO_LARGE", 422, "Ce document dépasse la taille maximale de téléchargement (8 Mo).");
    return result;
  } catch (error) {
    if (error instanceof InterviewError) throw error;
    throw new InterviewError(expired ? "PDF_TIMEOUT" : "PDF_UNAVAILABLE", 503, "La préparation du PDF est momentanément indisponible. Réessaie.");
  } finally {
    if (timer) clearTimeout(timer);
    // Keep the capacity reserved until Chromium is actually closed.
    try { await browser?.close(); } finally { slots.delete(ownerId); }
  }
}
