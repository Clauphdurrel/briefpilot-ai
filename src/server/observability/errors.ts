import "server-only";
import * as Sentry from "@sentry/nextjs";
import { safeErrorCode, safeErrorModule, scrubSentryEvent, sentryOptions } from "@/lib/observability/sentry-options";
import { currentOperation } from "./context";
import { logEvent } from "./logger";

type Fields = { module?: string; errorCode?: string; requestId?: string; operationId?: string };
export function reportError(error: unknown, fields: Fields = {}): void {
  try {
    const context = currentOperation();
    if (error && typeof error === "object" && context?.reportedErrors) {
      if (context.reportedErrors.has(error)) return;
      context.reportedErrors.add(error);
    }
    let code: unknown = fields.errorCode;
    if (!code && error && typeof error === "object" && "code" in error) code = error.code;
    const event = scrubSentryEvent({ tags: {
      module: safeErrorModule(fields.module ?? context?.module), errorCode: safeErrorCode(code),
      requestId: fields.requestId ?? context?.requestId, operationId: fields.operationId ?? context?.operationId,
    } });
    logEvent("error_reported", event.tags ?? {});
    if (sentryOptions("server").enabled) Sentry.captureEvent(event);
  } catch { /* Includes hostile error getters, unavailable SDKs and logger failures. */ }
}
