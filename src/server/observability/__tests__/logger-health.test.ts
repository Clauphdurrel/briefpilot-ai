import { afterEach, expect, it, vi } from "vitest";
import { createStructuredLogger, safeError } from "../logger";
import { GET } from "@/app/api/health/route";
afterEach(() => vi.unstubAllEnvs());
it("emits structured Pino fields without raw errors, identities or request content", () => {
  vi.stubEnv("LOG_LEVEL", "debug"); const output: string[] = [];
  const log = createStructuredLogger({ write: (line: string) => { output.push(line); } });
  log("operation_failed", { requestId: "00000000-0000-4000-8000-000000000001", operationId: "00000000-0000-4000-8000-000000000002",
    module: "brief", durationMs: 120, statusCode: 503, errorCode: "BRIEF_UNAVAILABLE", email: "person@example.invalid", body: "PRIVATE BODY", error: new Error("PRIVATE ERROR"), cookie: "PRIVATE COOKIE", userId: "PRIVATE ID" }, "error");
  const entry = JSON.parse(output[0]);
  expect(entry).toMatchObject({ level: "error", event: "operation_failed", durationMs: 120, module: "brief", statusCode: 503 });
  expect(entry.time).toMatch(/^\d{4}-\d{2}-\d{2}T/); expect(entry.requestId).toBeTruthy();
  expect(output[0]).not.toMatch(/PRIVATE|person@example|hostname|"pid"/);
});
it("uses an explicit code allowlist rather than forwarding arbitrary error strings or getters", () => {
  expect(safeError({ code: "BRIEF_UNAVAILABLE", message: "PRIVATE" })).toEqual({ errorCode: "BRIEF_UNAVAILABLE" });
  expect(safeError({ code: "AI_PRIVATE_SECRET" })).toEqual({ errorCode: "INTERNAL_ERROR" });
  expect(safeError({ get code() { throw new Error("PRIVATE"); } })).toEqual({ errorCode: "INTERNAL_ERROR" });
});
it("returns only public liveness status without dependency calls or cached configuration", async () => {
  const response = GET(); expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
