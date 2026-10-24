import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { safeErrorCode, scrubSentryEvent, sentryOptions } from "@/lib/observability/sentry-options";

const sdk = vi.hoisted(() => ({ init: vi.fn(), captureEvent: vi.fn(), captureRequestError: vi.fn(), globalHandlersIntegration: vi.fn() }));
const logger = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@sentry/nextjs", () => sdk);
vi.mock("@/server/observability/logger", () => logger);
vi.mock("@/server/observability/context", () => ({ currentOperation: () => ({ requestId: "00000000-0000-4000-8000-000000000001", module: "interview", userId: "private-user", projectId: "private-project" }) }));
const configured = { enabled: "true", dsn: "https://publickey@o123.ingest.sentry.io/123", environment: "staging", nodeEnv: "production" };
beforeEach(() => { vi.resetAllMocks(); sdk.globalHandlersIntegration.mockReturnValue({ name: "GlobalHandlers" }); });
afterEach(() => vi.unstubAllEnvs());

it.each([
  {}, { ...configured, enabled: "false" }, { ...configured, enabled: "TRUE" },
  { ...configured, dsn: undefined }, { ...configured, dsn: "not-a-dsn" },
  { ...configured, dsn: "http://publickey@o123.ingest.sentry.io/123" },
  { ...configured, dsn: "https://publickey:secret@o123.ingest.sentry.io/123" },
  { ...configured, environment: undefined }, { ...configured, environment: "private-customer@example.invalid" },
  { ...configured, nodeEnv: "test" }, { ...configured, testMode: "true" }, { ...configured, testMode: "1" },
])("remains disabled without complete explicit opt-in or during tests: %j", (env) => {
  const options = sentryOptions("server", env);
  expect(options.enabled).toBe(false); expect(options).not.toHaveProperty("dsn");
});
it("enables only sanitized error monitoring with traces, replay, profiling and SDK logs off", () => {
  const options = sentryOptions("server", configured);
  expect(options.enabled).toBe(true); expect(options.environment).toBe("staging");
  expect(options).toMatchObject({ tracesSampleRate: 0, profilesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0, defaultIntegrations: false, sendDefaultPii: false, enableLogs: false, maxBreadcrumbs: 0, sendClientReports: false });
  expect(options.beforeSendTransaction()).toBeNull(); expect(options.beforeSendLog()).toBeNull(); expect(options.beforeBreadcrumb()).toBeNull();
});
it("rebuilds events without request data, identity, messages, source context or arbitrary tags", () => {
  const dirty = {
    message: "password=secretpassword", request: { url: "https://private.example/project/123?token=secret", headers: { authorization: "Bearer secret" }, data: "client transcript", cookies: "session-token" },
    user: { id: "private-user", email: "person@example.invalid" }, extra: { prompt: "client transcript" }, breadcrumbs: [{ message: "client transcript" }],
    contexts: { private: { secret: "api-key" } }, transaction: "/projects/private-id", release: "private-release", server_name: "private-host",
    tags: { module: "interview", errorCode: "AI_TIMEOUT", requestId: "00000000-0000-4000-8000-000000000001", operationId: "person@example.invalid", email: "person@example.invalid" },
    exception: { values: [{ type: "SecretError", value: "client transcript and secretpassword", stacktrace: { frames: [{ filename: "/home/private-user/src/server/agents/interview-client.agent.ts", function: "runInterviewClientAgent", lineno: 42, colno: 3, pre_context: ["secretpassword"], context_line: "api-key", vars: { private: "client transcript" } }] } }] },
  } as unknown as ErrorEvent;
  const clean = scrubSentryEvent(dirty), output = JSON.stringify(clean);
  for (const secret of ["secretpassword", "private-user", "person@example.invalid", "client transcript", "session-token", "private-host", "api-key", "private-release", "SecretError"]) expect(output).not.toContain(secret);
  expect(clean.exception?.values?.[0]).toMatchObject({ type: "Error", value: "BriefPilot error: AI_TIMEOUT", stacktrace: { frames: [{ filename: "src/server/agents/interview-client.agent.ts", function: "runInterviewClientAgent", lineno: 42, colno: 3, in_app: true }] } });
  expect(Object.keys(clean).sort()).toEqual(["exception", "fingerprint", "level", "message", "tags", "type"]);
  expect(clean.type).toBeUndefined();
  expect(dirty.message).toContain("secretpassword");
});
it.each([
  "https://private.example/src/server/ai/openai.ts?token=secret", "src/server/ai/openai.ts?token=secret",
  "src/server/services/customer-private-id.ts", "src/server/services/00000000-0000-4000-8000-000000000001.ts",
  "src/server/../private.ts", "/home/private-user/private.ts",
])("drops non-whitelisted or URL-like stack locations: %s", (filename) => {
  const clean = scrubSentryEvent({ exception: { values: [{ stacktrace: { frames: [{ filename }] } }] } });
  expect(clean.exception?.values?.[0].stacktrace).toBeUndefined();
});
it("uses a generic code and module rather than forwarding unrecognized values", () => {
  const clean = scrubSentryEvent({ tags: { errorCode: "secretpassword", module: "person@example.invalid", requestId: "client-supplied-value" } });
  expect(clean.tags).toEqual({ module: "unknown", errorCode: "UNEXPECTED_ERROR" }); expect(safeErrorCode("__proto__")).toBe("UNEXPECTED_ERROR");
});
it("does not initialize or capture remotely when disabled, including the Next request-error hook", async () => {
  vi.stubEnv("OBSERVABILITY_ENABLED", "false"); vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENABLED", "false");
  const { register, onRequestError } = await import("@/instrumentation");
  await register(); onRequestError(new Error("private"), {} as never, {} as never);
  await import("@/instrumentation-client");
  expect(sdk.init).not.toHaveBeenCalled(); expect(sdk.captureRequestError).not.toHaveBeenCalled();
});
it("does not let an explicit false monitoring test flag override the E2E boundary", () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("OBSERVABILITY_ENABLED", "true");
  vi.stubEnv("OBSERVABILITY_ENVIRONMENT", "staging"); vi.stubEnv("SENTRY_DSN", configured.dsn);
  vi.stubEnv("OBSERVABILITY_TEST_MODE", "false"); vi.stubEnv("E2E_TEST", "true");
  expect(sentryOptions("server").enabled).toBe(false);
});
it("reports safe structured fields locally but performs no SDK capture in tests", async () => {
  vi.stubEnv("OBSERVABILITY_ENABLED", "true"); vi.stubEnv("SENTRY_DSN", configured.dsn); vi.stubEnv("OBSERVABILITY_ENVIRONMENT", "staging"); vi.stubEnv("NODE_ENV", "test");
  const { reportError } = await import("../errors");
  reportError(new Error("password=secretpassword"), { errorCode: "AI_TIMEOUT" });
  expect(sdk.captureEvent).not.toHaveBeenCalled(); expect(logger.logEvent).toHaveBeenCalledWith("error_reported", expect.objectContaining({ module: "interview", errorCode: "AI_TIMEOUT" }));
  expect(JSON.stringify(logger.logEvent.mock.calls)).not.toContain("secretpassword"); expect(JSON.stringify(logger.logEvent.mock.calls)).not.toContain("private-user");
});
it("does not throw if the enabled SDK fails", async () => {
  // This SDK is mocked above: explicitly select its enabled branch regardless of CI flags.
  vi.stubEnv("E2E_TEST", "false"); vi.stubEnv("PLAYWRIGHT_TEST", "false");
  vi.stubEnv("OBSERVABILITY_ENABLED", "true"); vi.stubEnv("SENTRY_DSN", configured.dsn); vi.stubEnv("OBSERVABILITY_ENVIRONMENT", "staging"); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("OBSERVABILITY_TEST_MODE", "false");
  sdk.captureEvent.mockImplementationOnce(() => { throw new Error("private SDK details"); });
  const { reportError } = await import("../errors");
  expect(() => reportError(new Error("private stack and transcript"), { module: "pdf", errorCode: "PDF_TIMEOUT" })).not.toThrow();
  expect(sdk.captureEvent).toHaveBeenCalledOnce(); expect(JSON.stringify(sdk.captureEvent.mock.calls)).not.toContain("transcript");
});
it("never propagates hostile error getters or logger errors", async () => {
  const { reportError } = await import("../errors");
  expect(() => reportError({ get code() { throw new Error("private"); } })).not.toThrow();
  logger.logEvent.mockImplementationOnce(() => { throw new Error("logger failed"); });
  expect(() => reportError(new Error("private"))).not.toThrow();
});
