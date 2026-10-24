import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry-options";

const options = sentryOptions("client");
if (options.enabled) {
  try { Sentry.init({ ...options, integrations: [Sentry.globalHandlersIntegration()] }); } catch { /* Keep the UI operational if initialization fails. */ }
}
// No router-transition hook: navigation tracing is deliberately disabled.
