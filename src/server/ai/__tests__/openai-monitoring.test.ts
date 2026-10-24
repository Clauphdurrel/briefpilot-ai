import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getOpenAI } from "../openai";
const mocks = vi.hoisted(() => ({ parse: vi.fn(), meter: vi.fn(), monitor: vi.fn(), usage: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse: mocks.parse }; } }));
vi.mock("../usage-context", () => ({ currentUsage: mocks.usage, meterProvider: mocks.meter }));
vi.mock("@/server/observability/ai-monitoring", () => ({ aiMonitoringEnabled: () => process.env.OBSERVABILITY_ENABLED === "true" && process.env.AI_MONITORING_ENABLED === "true", monitorAI: mocks.monitor }));
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("OPENAI_API_KEY", "test-key-not-real"); vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
  vi.stubEnv("OBSERVABILITY_ENABLED", "true"); vi.stubEnv("AI_MONITORING_ENABLED", "true");
  mocks.parse.mockResolvedValue({ status: "completed" }); mocks.meter.mockImplementation((action: () => Promise<unknown>) => action());
  mocks.monitor.mockImplementation((_params: unknown, action: () => Promise<unknown>) => action());
  mocks.usage.mockReturnValue({ id: "quota", userId: "owner" });
});
afterEach(() => vi.unstubAllEnvs());
it("calls the existing quota wrapper and monitoring around exactly one SDK request", async () => {
  const params = { model: "gpt-4.1-mini", input: "private" };
  await getOpenAI().client.responses.parse(params);
  expect(mocks.meter).toHaveBeenCalledOnce(); expect(mocks.monitor).toHaveBeenCalledOnce(); expect(mocks.parse).toHaveBeenCalledOnce();
  expect(mocks.parse).toHaveBeenCalledWith(params); expect(mocks.monitor.mock.calls[0][0]).toBe(params);
});
it("preserves quota metering and skips monitoring when disabled", async () => {
  vi.stubEnv("AI_MONITORING_ENABLED", "false"); await getOpenAI().client.responses.parse({ model: "gpt-4.1-mini", input: "private" });
  expect(mocks.meter).toHaveBeenCalledOnce(); expect(mocks.monitor).not.toHaveBeenCalled(); expect(mocks.parse).toHaveBeenCalledOnce();
});
it("can observe a call without a quota context without creating a quota debit", async () => {
  mocks.usage.mockReturnValue(undefined); await getOpenAI().client.responses.parse({ model: "gpt-4.1-mini", input: "private" });
  expect(mocks.meter).not.toHaveBeenCalled(); expect(mocks.monitor).toHaveBeenCalledOnce(); expect(mocks.parse).toHaveBeenCalledOnce();
});
