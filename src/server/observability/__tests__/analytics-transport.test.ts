import { expect, it, vi } from "vitest";
import { PostHog } from "posthog-node";
import { scrubAnalyticsEvent } from "../analytics";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
it("sends only a scrubbed business event through the actual SDK transport", async () => {
  const requests: { url: string; body: string }[] = [];
  const sdk = new PostHog("synthetic-project-token", {
    host: "https://eu.i.posthog.com", flushAt: 1, flushInterval: 0,
    disableCompression: true, fetchRetryCount: 0, disableGeoip: true,
    enableExceptionAutocapture: false, before_send: scrubAnalyticsEvent,
    fetch: async (url, options) => {
      requests.push({ url: String(url), body: String(options?.body ?? "") });
      return { status: 200, text: async () => "OK", json: async () => ({ status: 1 }) };
    },
  });
  try {
    const identity = `usr_${"a".repeat(64)}`, uuid = "12345678-1234-4234-8234-123456789012";
    await sdk.captureImmediate({ distinctId: identity, event: "brief_generated", uuid, sendFeatureFlags: false,
      properties: { environment: "staging", documentKind: "brief", email: "PRIVATE@example.invalid", prompt: "PRIVATE CLIENT TEXT", $set: { name: "PRIVATE NAME" }, $insert_id: uuid } });
    await sdk.flush();
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toMatch(/^https:\/\/eu\.i\.posthog\.com\/(batch|i\/v0\/e)/);
    const body = JSON.parse(requests[0].body), event = body.batch[0];
    expect(event).toMatchObject({ event: "brief_generated", distinct_id: identity, uuid,
      properties: { environment: "staging", documentKind: "brief", $geoip_disable: true, $process_person_profile: false, $insert_id: uuid } });
    expect(requests[0].body).not.toContain("PRIVATE");
    expect(event.properties).not.toHaveProperty("$set");
  } finally { await sdk.shutdown(); }
});
