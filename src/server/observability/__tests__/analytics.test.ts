import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { analyticsConfig, analyticsIdentity, captureBusinessEvent, scrubAnalyticsEvent } from "../analytics";
const mocks = vi.hoisted(() => ({ consent: vi.fn(), capture: vi.fn(), init: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.consent } } }));
vi.mock("../logger", () => ({ logEvent: mocks.log }));
vi.mock("posthog-node", () => ({ PostHog: class { constructor(...args: unknown[]) { mocks.init(...args); } captureImmediate = mocks.capture; on() {} } }));
let configId = 0;
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries({ NODE_ENV: "production", OBSERVABILITY_ENABLED: "true", POSTHOG_ENABLED: "true", OBSERVABILITY_ENVIRONMENT: "staging",
    POSTHOG_PROJECT_TOKEN: `synthetic-token-${++configId}`, POSTHOG_HOST: "https://eu.i.posthog.com", ANALYTICS_HMAC_SECRET: "synthetic-analytics-secret-at-least-32-characters",
    OBSERVABILITY_TEST_MODE: "false", E2E_TEST: "false", PLAYWRIGHT_TEST: "false" })) vi.stubEnv(key, value);
  mocks.consent.mockResolvedValue({ analyticsConsent: true }); mocks.capture.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each(["OBSERVABILITY_ENABLED", "POSTHOG_ENABLED"])("does not query, initialize or deliver when %s is off", async (flag) => {
  vi.stubEnv(flag, "false"); await captureBusinessEvent("user-1", "project_created", "project-1");
  expect(mocks.consent).not.toHaveBeenCalled(); expect(mocks.init).not.toHaveBeenCalled(); expect(mocks.capture).not.toHaveBeenCalled();
});
it.each(["OBSERVABILITY_TEST_MODE", "E2E_TEST", "PLAYWRIGHT_TEST"])("never sends test events when %s is set", async (flag) => {
  vi.stubEnv(flag, "true"); await captureBusinessEvent("user-1", "brief_generated", "brief-1");
  expect(mocks.consent).not.toHaveBeenCalled(); expect(mocks.capture).not.toHaveBeenCalled();
});
it("never sends from NODE_ENV=test or development to the production project", async () => {
  vi.stubEnv("NODE_ENV", "test"); expect(analyticsConfig()).toBeNull();
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("OBSERVABILITY_ENVIRONMENT", "production"); expect(analyticsConfig()).toBeNull();
});
it.each([["POSTHOG_HOST", "https://attacker.invalid"], ["ANALYTICS_HMAC_SECRET", "short"], ["OBSERVABILITY_ENVIRONMENT", "customer-secret"], ["POSTHOG_PROJECT_TOKEN", ""]])("fails closed on invalid configuration %s", (key, value) => {
  vi.stubEnv(key, value); expect(analyticsConfig()).toBeNull();
});
it("requires current stored consent for every delivery", async () => {
  mocks.consent.mockResolvedValueOnce({ analyticsConsent: false }); await captureBusinessEvent("user-1", "project_created", "project-1");
  expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.init).not.toHaveBeenCalled();
  mocks.consent.mockResolvedValueOnce({ analyticsConsent: true }); await captureBusinessEvent("user-1", "project_created", "project-1");
  mocks.consent.mockResolvedValueOnce({ analyticsConsent: false }); await captureBusinessEvent("user-1", "brief_generated", "brief-1");
  expect(mocks.capture).toHaveBeenCalledOnce();
});
it("uses stable environment-scoped HMAC identities and event UUIDs without client contents", async () => {
  await captureBusinessEvent("user-1", "brief_generated", "brief-private-id", { plan: "PRO", email: "person@example.invalid", prompt: "PRIVATE CLIENT TEXT" } as never);
  await captureBusinessEvent("user-1", "brief_generated", "brief-private-id", { plan: "PRO" });
  const first = mocks.capture.mock.calls[0][0], second = mocks.capture.mock.calls[1][0];
  expect(first.uuid).toBe(second.uuid); expect(first.distinctId).toMatch(/^usr_[a-f0-9]{64}$/);
  expect(first.properties.$insert_id).toBe(first.uuid); expect(first.sendFeatureFlags).toBe(false); expect(first.disableGeoip).toBe(true);
  expect(JSON.stringify(mocks.capture.mock.calls)).not.toMatch(/user-1|brief-private-id|PRIVATE|person@example/);
  const config = analyticsConfig()!;
  expect(analyticsIdentity("user-1", config)).not.toBe(analyticsIdentity("user-1", { ...config, environment: "production" }));
  expect(mocks.init.mock.calls[0][1]).toMatchObject({ enableExceptionAutocapture: false, flushInterval: 0, fetchRetryCount: 0 });
});
it("reconstructs PostHog events and drops automatic events, profiles and unknown properties", () => {
  const clean = scrubAnalyticsEvent({ event: "project_created", distinctId: `usr_${"a".repeat(64)}`, uuid: "00000000-0000-4000-8000-000000000001", $set: { email: "person@example.invalid" },
    properties: { plan: "PRO", environment: "staging", email: "person@example.invalid", $current_url: "https://private/path", $process_person_profile: true } } as never);
  expect(clean?.properties).toMatchObject({ plan: "PRO", $geoip_disable: true, $process_person_profile: false });
  expect(clean?.distinctId).toBe(`usr_${"a".repeat(64)}`);
  expect(JSON.stringify(clean)).not.toMatch(/person@example|private\/path|\$set/);
  expect(scrubAnalyticsEvent({ event: "$pageview", properties: {} })).toBeNull();
});
it("swallows SDK/database failures and logs only a generic code", async () => {
  mocks.capture.mockRejectedValueOnce(new Error("PRIVATE SDK KEY"));
  await expect(captureBusinessEvent("user-1", "project_created", "project-1")).resolves.toBeUndefined();
  mocks.consent.mockRejectedValueOnce(new Error("PRIVATE DB URL"));
  await expect(captureBusinessEvent("user-1", "project_created", "project-2")).resolves.toBeUndefined();
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("PRIVATE");
});
it("abandons delayed consent lookup after the deadline instead of sending later", async () => {
  vi.useFakeTimers(); let release!: (value: { analyticsConsent: boolean }) => void;
  mocks.consent.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const pending = captureBusinessEvent("user-1", "project_created", "project-1");
  await vi.advanceTimersByTimeAsync(1001); await pending;
  release({ analyticsConsent: true }); await Promise.resolve(); await Promise.resolve();
  expect(mocks.capture).not.toHaveBeenCalled();
});
