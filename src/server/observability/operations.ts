import "server-only";
import { performance } from "node:perf_hooks";
import { currentOperation, withOperation, type OperationContext } from "./context";
import { logEvent, safeError } from "./logger";
import { ZodError } from "zod";
import { reportError } from "./errors";
import { captureBusinessEvent } from "./analytics";
import type { Resource } from "@/config/plans";

type Fields = Pick<OperationContext, "userId" | "projectId">;
export function observed<Args extends unknown[], Result>(module: string, operation: string,
  action: (...args: Args) => Promise<Result>, fields: (...args: Args) => Fields,
  succeeded?: (result: Result, ...args: Args) => Promise<void>,
): (...args: Args) => Promise<Result> {
  return (...args) => withOperation({ module, ...fields(...args) }, async () => {
    const started = performance.now();
    try {
      const result = await action(...args);
      try { await succeeded?.(result, ...args); } catch { /* Telemetry cannot invalidate a committed result. */ }
      try { logEvent("operation_completed", { operation, status: "SUCCESS", durationMs: Math.round(performance.now() - started) }); } catch { /* Best effort. */ }
      return result;
    } catch (error) {
      try {
        const known = error && typeof error === "object" ? error as { code?: unknown; status?: unknown; resource?: unknown } : {};
        const context = currentOperation();
        const status = error instanceof ZodError ? 400 : typeof known.status === "number" && Number.isInteger(known.status) && known.status >= 400 && known.status <= 599 ? known.status : 500;
        logEvent("operation_failed", { operation, ...safeError(error), status: "ERROR", statusCode: status, durationMs: Math.round(performance.now() - started) }, status >= 500 ? "error" : "warn");
        if (known.code === "QUOTA_EXCEEDED" && context?.userId && ["ACTIVE_PROJECTS", "AI_INTERVIEW", "AI_BRIEF", "AI_BACKLOG", "PDF_EXPORT"].includes(String(known.resource))) {
          await captureBusinessEvent(context.userId, "quota_exceeded", context.operationId!, { resource: known.resource as Resource });
        }
        if (status >= 500) reportError(error, { module });
      } catch { /* Even a hostile error getter or broken telemetry preserves the original error. */ }
      throw error;
    }
  });
}
