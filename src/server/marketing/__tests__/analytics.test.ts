import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  capture: vi.fn(),
  init: vi.fn(),
}));
vi.mock("@/server/observability/analytics", () => ({
  analyticsConfig: mocks.config,
  analyticsIdentity: () => `usr_${"a".repeat(64)}`,
}));
vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor(...args: unknown[]) {
      mocks.init(...args);
    }
    on() {}
    captureImmediate = mocks.capture;
  },
}));
import {
  captureConsentedMarketingEvent,
  marketingEventSchema,
  scrubMarketingEvent,
} from "../analytics";
const input = () => ({
  consent: true,
  anonymousId: randomUUID(),
  viewId: randomUUID(),
  event: "landing_viewed",
  page: "home",
  placement: "page",
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MARKETING_ANALYTICS_ENABLED", "true");
  mocks.config.mockReturnValue({
    token: "synthetic-public-ingestion-token",
    host: "https://eu.i.posthog.com",
    secret: randomUUID(),
    environment: "staging",
  });
  mocks.capture.mockResolvedValue(undefined);
});
it("requires explicit consent, UUIDs and an exact allowlist", async () => {
  for (const bad of [
    { ...input(), consent: false },
    { ...input(), text: "PRIVATE CLIENT TEXT" },
    { ...input(), anonymousId: "person@example.invalid" },
    { ...input(), event: "waitlist_joined" },
    { ...input(), page: "https://secret.invalid/?token=private" },
  ]) {
    expect(marketingEventSchema.safeParse(bad).success).toBe(false);
    await captureConsentedMarketingEvent(bad);
  }
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("makes no SDK request when conversion or global telemetry is disabled", async () => {
  vi.stubEnv("MARKETING_ANALYTICS_ENABLED", "false");
  await captureConsentedMarketingEvent(input());
  vi.stubEnv("MARKETING_ANALYTICS_ENABLED", "true");
  mocks.config.mockReturnValue(null);
  await captureConsentedMarketingEvent(input());
  expect(mocks.init).not.toHaveBeenCalled();
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("deduplicates events and sends only pseudonyms and fixed properties", async () => {
  const value = input();
  await captureConsentedMarketingEvent(value);
  await captureConsentedMarketingEvent(value);
  expect(mocks.capture).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain(
    value.anonymousId,
  );
  expect(mocks.capture.mock.calls[0][0]).toMatchObject({
    event: "landing_viewed",
    properties: { page: "home", placement: "page" },
    disableGeoip: true,
    sendFeatureFlags: false,
  });
});
it("strips URL, email and SDK context before transmission", () => {
  const result = scrubMarketingEvent({
    event: "signup_started",
    distinctId: `usr_${"a".repeat(64)}`,
    properties: {
      page: "home",
      placement: "hero",
      email: "PRIVATE",
      $current_url: "PRIVATE",
      $ip: "PRIVATE",
      text: "PRIVATE",
    },
  } as never);
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(
    scrubMarketingEvent({
      event: "$autocapture",
      distinctId: "secret",
      properties: {},
    } as never),
  ).toBeNull();
});
it("does not fail navigation when the provider is unavailable", async () => {
  mocks.capture.mockRejectedValue(new Error("PRIVATE SDK CONFIG"));
  await expect(
    captureConsentedMarketingEvent(input()),
  ).resolves.toBeUndefined();
});
