import "server-only";
import pino, { type DestinationStream } from "pino";
import { currentOperation } from "./context";
import { safeErrorCode } from "@/lib/observability/sentry-options";
const levels = ["debug", "info", "warn", "error", "fatal"] as const;
type Level = typeof levels[number];
const identifier = /^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9-]{27}|c[a-z0-9]{20,31})$/;
const numericFields = new Set(["durationMs", "inputTokens", "outputTokens", "cachedInputTokens", "totalTokens", "estimatedCost", "statusCode"]);
const labelFields = new Set(["module", "operation", "agentName", "model", "status", "usageStatus", "currency", "pricingVersion", "resource", "errorCode", "environment"]);
export function safeFields(fields: Record<string, unknown>): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (["requestId", "operationId", "attemptId"].includes(key) && typeof value === "string" && identifier.test(value)) result[key] = value;
    if (numericFields.has(key) && (value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0))) result[key] = value;
    if (labelFields.has(key) && typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(value)) result[key] = value;
  }
  return result;
}
export function safeError(error: unknown) {
  try {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const safe = safeErrorCode(code);
    return { errorCode: safe === "UNEXPECTED_ERROR" ? "INTERNAL_ERROR" : safe };
  } catch { return { errorCode: "INTERNAL_ERROR" }; }
}
export function createStructuredLogger(destination?: DestinationStream) {
  const configured = process.env.LOG_LEVEL;
  const logger = pino({ level: levels.includes(configured as Level) ? configured : "info", base: undefined, timestamp: pino.stdTimeFunctions.isoTime, formatters: { level: (label) => ({ level: label }) } }, destination);
  return (event: string, fields: Record<string, unknown> = {}, level: Level = "info") => {
    if (!/^[a-z][a-z_]{0,59}$/.test(event)) return;
    logger[level]({ event, ...safeFields(fields) });
  };
}
let sink: ReturnType<typeof createStructuredLogger> | undefined;
export function logEvent(event: string, fields: Record<string, unknown> = {}, level: Level = "info") {
  if (process.env.OBSERVABILITY_ENABLED !== "true") return;
  try { (sink ??= createStructuredLogger())(event, { ...currentOperation(), ...fields }, level); } catch { /* Telemetry cannot fail business operations. */ }
}
