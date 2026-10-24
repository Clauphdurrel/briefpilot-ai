import OpenAI from "openai";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AI_PRICING_VERSION, estimateTextCost } from "@/config/ai-pricing";
import { monitorAI } from "../ai-monitoring";
const mocks = vi.hoisted(() => ({ create: vi.fn(), log: vi.fn(), context: vi.fn(), usage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { aIUsageLog: { create: mocks.create } } }));
vi.mock("../context", () => ({ currentOperation: mocks.context }));
vi.mock("../logger", () => ({ logEvent: mocks.log }));
vi.mock("@/server/ai/usage-context", () => ({ currentUsage: mocks.usage }));
const request = { model: "gpt-4.1-mini", text: { format: { name: "interview_turn" } }, input: "PRIVATE PROMPT password=verysecret" };
const response = () => ({ status: "completed", model: "gpt-4.1-mini-2025-04-14", service_tier: "default", usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 100, total_tokens: 1100 }, output: [{ type: "message", content: [{ type: "output_text", text: "PRIVATE OUTPUT" }] }], output_parsed: { private: "PRIVATE PARSED" } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("OBSERVABILITY_ENABLED", "true"); vi.stubEnv("AI_MONITORING_ENABLED", "true");
  mocks.create.mockResolvedValue({ id: "log" });
  mocks.context.mockReturnValue({ requestId: "request-1", operationId: "operation-1", userId: "context-user", projectId: "project-1" });
  mocks.usage.mockReturnValue({ id: "quota", userId: "owner" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each(["OBSERVABILITY_ENABLED", "AI_MONITORING_ENABLED"])("does nothing when %s is disabled", async (key) => {
  vi.stubEnv(key, "false"); const result = response(), action = vi.fn(async () => result);
  expect(await monitorAI(request, action)).toBe(result); expect(action).toHaveBeenCalledOnce(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.log).not.toHaveBeenCalled();
});
it("records one real invocation with measured cached usage, exact known cost and safe metadata", async () => {
  const result = response(), action = vi.fn(async () => result);
  expect(await monitorAI(request, action)).toBe(result); expect(action).toHaveBeenCalledOnce(); expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ userId: "owner", projectId: "project-1", requestId: "request-1", operationId: "operation-1", agent: "InterviewClientAgent", model: "gpt-4.1-mini-2025-04-14", inputTokens: 1000, cachedInputTokens: 200, outputTokens: 100, totalTokens: 1100, estimatedCost: "0.000500000000", currency: "USD", pricingVersion: AI_PRICING_VERSION, status: "SUCCESS", errorCode: null, usageStatus: "KNOWN" });
  expect(mocks.create.mock.calls[0][0].data.durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify([mocks.create.mock.calls, mocks.log.mock.calls])).not.toMatch(/PRIVATE|verysecret/);
});
it("assigns distinct attempt identities to two actual calls with the same operation id", async () => {
  await monitorAI(request, async () => response()); await monitorAI(request, async () => response());
  expect(mocks.create.mock.calls[0][0].data.attemptId).not.toBe(mocks.create.mock.calls[1][0].data.attemptId);
});
it.each(["new-model", "gpt-4.1-mini-2099-01-01", "__proto__"])("does not invent a price for %s", async (model) => {
  await monitorAI(request, async () => ({ ...response(), model }));
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ estimatedCost: null, pricingVersion: null, usageStatus: "KNOWN" });
});
it.each(["priority", "flex", undefined])("does not apply Standard pricing to an unverified service tier %s", async (service_tier) => {
  await monitorAI(request, async () => ({ ...response(), service_tier }));
  expect(mocks.create.mock.calls[0][0].data.estimatedCost).toBeNull();
});
it.each([undefined, { input_tokens: -1 }, { input_tokens: 1.5 }])("represents missing or invalid usage as unknown rather than zero", async (usage) => {
  await monitorAI(request, async () => ({ ...response(), usage }));
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ usageStatus: "UNKNOWN", estimatedCost: null, inputTokens: null, outputTokens: null, totalTokens: null });
});
it("does not estimate an unhandled cache-write surcharge", async () => {
  const result = response(); Object.assign(result.usage.input_tokens_details, { cache_write_tokens: 100 });
  await monitorAI(request, async () => result); expect(mocks.create.mock.calls[0][0].data.estimatedCost).toBeNull();
});
it("records an unknown-cost timeout and preserves the exact provider exception", async () => {
  const error = new OpenAI.APIConnectionTimeoutError({ message: "PRIVATE ERROR sk-never-log-this" });
  await expect(monitorAI(request, async () => { throw error; })).rejects.toBe(error);
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ status: "ERROR", errorCode: "AI_TIMEOUT", usageStatus: "UNKNOWN", estimatedCost: null });
  expect(JSON.stringify([mocks.create.mock.calls, mocks.log.mock.calls])).not.toMatch(/PRIVATE|sk-never/);
});
it.each([["incomplete", "AI_INCOMPLETE"], ["failed", "AI_INCOMPLETE"]])("records a resolved %s response as an error while retaining real usage", async (status, errorCode) => {
  const result = { ...response(), status }; expect(await monitorAI(request, async () => result)).toBe(result);
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ status: "ERROR", errorCode, usageStatus: "KNOWN" });
});
it("records refusals without recording their text", async () => {
  await monitorAI(request, async () => ({ ...response(), output: [{ type: "message", content: [{ type: "refusal", refusal: "PRIVATE REFUSAL" }] }] }));
  expect(mocks.create.mock.calls[0][0].data.errorCode).toBe("AI_REFUSAL"); expect(JSON.stringify(mocks.create.mock.calls)).not.toContain("PRIVATE");
});
it("does not fail a successful generation when database and logger are unavailable", async () => {
  mocks.create.mockRejectedValue(new Error("PRIVATE DATABASE")); mocks.log.mockImplementation(() => { throw new Error("PRIVATE LOGGER"); });
  const result = response(); expect(await monitorAI(request, async () => result)).toBe(result);
});
it("bounds telemetry latency when persistence never resolves", async () => {
  vi.useFakeTimers(); mocks.create.mockImplementation(() => new Promise(() => {}));
  const result = response(), pending = monitorAI(request, async () => result);
  await vi.advanceTimersByTimeAsync(1001); expect(await pending).toBe(result);
  expect(mocks.log).toHaveBeenCalledWith("ai_monitoring_unavailable", expect.objectContaining({ errorCode: "AI_MONITORING_UNAVAILABLE" }));
});
it("uses only allowlisted agent names and rejects free text identifiers", async () => {
  mocks.context.mockReturnValue({ requestId: "person@example.com", projectId: "PRIVATE\nDATA" }); mocks.usage.mockReturnValue(undefined);
  await monitorAI({ ...request, text: { format: { name: "PRIVATE AGENT" } } }, async () => response());
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ agent: "UnknownAgent", requestId: null, projectId: null, userId: null });
  expect(JSON.stringify(mocks.create.mock.calls)).not.toMatch(/PRIVATE|person@example/);
});
it("known tariff calculation separates cached tokens and validates counts", () => {
  expect(estimateTextCost("gpt-4.1-mini", { input: 1000000, cachedInput: 1000000, output: 0 }, "default")?.amount).toBe("0.100000000000");
  expect(estimateTextCost("gpt-4.1-mini", { input: 1, cachedInput: 2, output: 0 }, "default")).toBeNull();
});

it.each([undefined, 1500])("preserves valid measured totals when cached usage is missing or invalid (%s)", async (cached_tokens) => {
  await monitorAI(request, async () => ({ ...response(), usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100, input_tokens_details: { cached_tokens } } }));
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ inputTokens: 1000, outputTokens: 100, totalTokens: 1100, cachedInputTokens: null, estimatedCost: null, usageStatus: "PARTIAL" });
});
