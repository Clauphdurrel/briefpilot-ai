import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry-options";

export async function register() {
  if (!sentryOptions(process.env.NEXT_RUNTIME === "edge" ? "edge" : "server").enabled) return;
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}
export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (!sentryOptions(process.env.NEXT_RUNTIME === "edge" ? "edge" : "server").enabled) return;
  try { return Sentry.captureRequestError(...args); } catch { /* Do not replace the original application error. */ }
};
