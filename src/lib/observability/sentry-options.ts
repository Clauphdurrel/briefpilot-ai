import type { ErrorEvent, StackFrame } from "@sentry/nextjs";

export type SentryRuntime = "server" | "client" | "edge";
type Environment = "development" | "staging" | "production";
export type SentryEnvironment = { enabled?: string; dsn?: string; environment?: string; nodeEnv?: string; testMode?: string };
const modules = new Set(["unknown", "nextjs", "global-error", "auth", "project", "interview", "brief", "backlog", "pdf", "billing", "exports", "usage"]);
const codes = new Set([
  "UNEXPECTED_ERROR", "INTERNAL_ERROR", "INVALID_INPUT", "UNAUTHENTICATED", "PROJECT_NOT_FOUND", "QUOTA_EXCEEDED",
  "AI_NOT_CONFIGURED", "AI_INVALID_OUTPUT", "AI_TIMEOUT", "AI_QUOTA", "AI_NETWORK", "AI_UNAVAILABLE", "AI_REFUSAL", "AI_INCOMPLETE",
  "BRIEF_INVALID_OUTPUT", "BRIEF_TIMEOUT", "BRIEF_QUOTA", "BRIEF_NETWORK", "BRIEF_UNAVAILABLE", "BRIEF_REFUSAL", "BRIEF_INCOMPLETE",
  "BACKLOG_INVALID_OUTPUT", "BACKLOG_INVALID_GRAPH", "BACKLOG_TIMEOUT", "BACKLOG_QUOTA", "BACKLOG_NETWORK", "BACKLOG_UNAVAILABLE", "BACKLOG_REFUSAL", "BACKLOG_INCOMPLETE",
  "PDF_TIMEOUT", "PDF_UNAVAILABLE", "PDF_TOO_LARGE", "PDF_BUSY", "EXPORT_SENSITIVE_CONTENT", "EXPORT_INVALID_DOCUMENT",
  "BILLING_PROVIDER_UNAVAILABLE", "BILLING_UNAVAILABLE", "BILLING_INVALID_RESPONSE", "BILLING_NOT_CONFIGURED", "USAGE_UNAVAILABLE",
]);
const safeFunctions = new Set(["GET", "POST", "register", "onRequestError", "reportError", "runInterviewClientAgent", "runBriefGeneratorAgent", "runBacklogGeneratorAgent", "renderPdf", "getOpenAI", "advanceInterview", "generateBrief", "generateBacklog"]);
const safeFiles = new Set([
  "src/auth.ts", "src/instrumentation.ts", "src/app/global-error.tsx",
  ...["auth", "project", "interview", "brief", "backlog", "subscription", "usage", "history-access"].map((name) => `src/server/services/${name}.service.ts`),
  ...["interview-client", "brief-generator", "backlog-generator"].map((name) => `src/server/agents/${name}.agent.ts`),
  ...["openai", "usage-context", "errors"].map((name) => `src/server/ai/${name}.ts`),
  ...["interview", "billing", "pdf-export", "markdown-export"].map((name) => `src/server/http/${name}.ts`),
  ...["billing.service", "webhook.service", "config", "providers/lemonsqueezy"].map((name) => `src/server/billing/${name}.ts`),
  ...["pdf-renderer", "pdf.service", "brief-pdf", "backlog-pdf", "project-pdf", "pdf-templates"].map((name) => `src/server/exports/pdf/${name}.ts`),
]);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function safeErrorCode(value: unknown): string { return typeof value === "string" && codes.has(value) ? value : "UNEXPECTED_ERROR"; }
export function safeErrorModule(value: unknown): string { return typeof value === "string" && modules.has(value) ? value : "unknown"; }
function safeFrame(raw: StackFrame): StackFrame | null {
  if (typeof raw.filename !== "string" || /[?#@]|:\/\//.test(raw.filename)) return null;
  const filename = /(?:^|\/)(src\/[A-Za-z0-9_./()[\]-]+\.(?:tsx?|jsx?))$/.exec(raw.filename)?.[1];
  if (!filename || !safeFiles.has(filename)) return null;
  const frame: StackFrame = { filename, in_app: true };
  if (typeof raw.function === "string" && safeFunctions.has(raw.function)) frame.function = raw.function;
  if (Number.isSafeInteger(raw.lineno) && raw.lineno! > 0 && raw.lineno! < 100000) frame.lineno = raw.lineno;
  if (Number.isSafeInteger(raw.colno) && raw.colno! > 0 && raw.colno! < 100000) frame.colno = raw.colno;
  return frame;
}

// Reconstruct from an allowlist; deleting a few known PII fields is insufficient.
// No original exception text, stack source context, request, SDK extras, breadcrumbs,
// user identifiers, transactions or attachments are retained.
export function scrubSentryEvent(event: Omit<ErrorEvent, "type"> & { type?: undefined }): ErrorEvent {
  const errorCode = safeErrorCode(event.tags?.errorCode);
  const errorModule = safeErrorModule(event.tags?.module);
  const tags: Record<string, string> = { errorCode, module: errorModule };
  for (const field of ["requestId", "operationId"] as const) {
    const value = event.tags?.[field];
    if (typeof value === "string" && uuid.test(value)) tags[field] = value;
  }
  const frames = event.exception?.values?.flatMap((exception) => exception.stacktrace?.frames ?? []).slice(-30).map(safeFrame).filter((frame): frame is StackFrame => frame !== null);
  return {
    type: undefined,
    level: "error", message: `BriefPilot error: ${errorCode}`, tags, fingerprint: [errorModule, errorCode],
    exception: { values: [{ type: "Error", value: `BriefPilot error: ${errorCode}`, ...(frames?.length ? { stacktrace: { frames } } : {}) }] },
  };
}

export function readSentryEnvironment(runtime: SentryRuntime): SentryEnvironment {
  if (runtime === "client") return {
    enabled: process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED, dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_OBSERVABILITY_ENVIRONMENT, nodeEnv: process.env.NODE_ENV,
    testMode: process.env.NEXT_PUBLIC_OBSERVABILITY_TEST_MODE,
  };
  return { enabled: process.env.OBSERVABILITY_ENABLED, dsn: process.env.SENTRY_DSN,
    environment: process.env.OBSERVABILITY_ENVIRONMENT, nodeEnv: process.env.NODE_ENV,
    testMode: process.env.OBSERVABILITY_TEST_MODE ?? process.env.E2E_TEST ?? process.env.PLAYWRIGHT_TEST,
  };
}
export function sentryOptions(runtime: SentryRuntime, env = readSentryEnvironment(runtime)) {
  let validDsn = false;
  try {
    const dsn = new URL(env.dsn ?? "");
    validDsn = dsn.protocol === "https:" && !!dsn.username && !dsn.password && !dsn.search && !dsn.hash && /^\/\d+$/.test(dsn.pathname);
  } catch { /* Missing or malformed configuration remains a no-op. */ }
  const environment = ["development", "staging", "production"].includes(env.environment ?? "") ? env.environment as Environment : undefined;
  const enabled = env.enabled === "true" && validDsn && !!environment && env.nodeEnv !== "test" && !["true", "1"].includes(env.testMode ?? "");
  return {
    enabled, ...(enabled ? { dsn: env.dsn, environment } : {}),
    sendDefaultPii: false, defaultIntegrations: false as const, maxBreadcrumbs: 0,
    sendClientReports: false, enableLogs: false,
    // Traces, replay and profiling deliberately stay off: only sanitized errors leave the app.
    tracesSampleRate: 0, profilesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: () => null, beforeSendLog: () => null, beforeBreadcrumb: () => null,
  };
}
