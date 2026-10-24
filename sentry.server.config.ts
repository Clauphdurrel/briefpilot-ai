import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./src/lib/observability/sentry-options";

const options = sentryOptions("server");
if (options.enabled) {
  try { Sentry.init(options); } catch { /* Observability must never stop the application. */ }
}
