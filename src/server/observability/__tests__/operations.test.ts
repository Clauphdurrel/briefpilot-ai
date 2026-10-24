import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { observed } from "../operations";
import { currentOperation, withOperation } from "../context";
const mocks = vi.hoisted(() => ({ log: vi.fn(), report: vi.fn(), capture: vi.fn() }));
vi.mock("../logger", () => ({ logEvent: mocks.log, safeError: () => ({ errorCode: "INTERNAL_ERROR" }) }));
vi.mock("../errors", () => ({ reportError: mocks.report }));
vi.mock("../analytics", () => ({ captureBusinessEvent: mocks.capture }));
beforeEach(() => { vi.resetAllMocks(); mocks.capture.mockResolvedValue(undefined); });
afterEach(() => vi.restoreAllMocks());
it("isolates concurrent requests and shares correlation through nested async work", async () => {
  const [a, b] = await Promise.all(["first", "second"].map((userId) => withOperation({ userId }, async () => {
    const root = currentOperation()!; await Promise.resolve();
    return withOperation({ module: "brief" }, () => ({ root, child: currentOperation()! }));
  })));
  expect(a.root.requestId).not.toBe(b.root.requestId); expect(a.root.operationId).not.toBe(b.root.operationId);
  expect(a.child.requestId).toBe(a.root.requestId); expect(a.child.operationId).toBe(a.root.operationId);
  expect(a.child.userId).toBe("first"); expect(b.child.userId).toBe("second"); expect(currentOperation()).toBeUndefined();
});
it("preserves optional provider arguments and the exact committed result", async () => {
  const result = { id: "saved" }, provider = { transport: "local" };
  const action = vi.fn(async (_user: string, _plan: string, providerArg: object = {}) => { expect(providerArg).toBe(provider); return result; });
  const operation: (user: string, plan: string, provider?: object) => Promise<typeof result> = observed("billing", "checkout", action, (userId) => ({ userId }));
  expect(await operation("owner", "PRO", provider)).toBe(result);
  expect(action).toHaveBeenCalledWith("owner", "PRO", provider);
  expect(mocks.log).toHaveBeenCalledWith("operation_completed", expect.objectContaining({ durationMs: expect.any(Number), status: "SUCCESS" }));
});
it("does not invalidate success when analytics and logger fail", async () => {
  mocks.log.mockImplementation(() => { throw new Error("PRIVATE LOGGER"); });
  const operation = observed("project", "create_project", async () => "saved", () => ({}), async () => { throw new Error("PRIVATE ANALYTICS"); });
  expect(await operation()).toBe("saved");
});
it("reports a technical failure while preserving its identity and no payload", async () => {
  const failure = new Error("PRIVATE CLIENT DATA");
  const operation = observed("brief", "generate_brief", async () => { throw failure; }, () => ({ userId: "owner" }));
  await expect(operation()).rejects.toBe(failure); expect(mocks.report).toHaveBeenCalledWith(failure, { module: "brief" });
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("PRIVATE");
});
it("does not send expected validation errors to Sentry", async () => {
  const operation = observed("brief", "generate_brief", async () => z.string().parse(1), () => ({}));
  await expect(operation()).rejects.toBeInstanceOf(z.ZodError); expect(mocks.report).not.toHaveBeenCalled();
  expect(mocks.log).toHaveBeenCalledWith("operation_failed", expect.objectContaining({ statusCode: 400 }), "warn");
});
it("emits a safe quota event and does not alert it as a server error", async () => {
  const failure = Object.assign(new Error("PRIVATE QUOTA DETAILS"), { code: "QUOTA_EXCEEDED", status: 429, resource: "PDF_EXPORT" });
  const operation = observed("pdf", "export_pdf", async () => { throw failure; }, () => ({ userId: "owner" }));
  await expect(operation()).rejects.toBe(failure); expect(mocks.report).not.toHaveBeenCalled();
  expect(mocks.capture).toHaveBeenCalledWith("owner", "quota_exceeded", expect.any(String), { resource: "PDF_EXPORT" });
});
it("preserves hostile exceptions and a failure even with broken error monitoring", async () => {
  const failure = Object.defineProperty(new Error("PRIVATE"), "status", { get() { throw new Error("PRIVATE GETTER"); } });
  const operation = observed("billing", "webhook", async () => { throw failure; }, () => ({}));
  await expect(operation()).rejects.toBe(failure);
});
