import "server-only";
import { createHmac } from "node:crypto";
import { PostHog, type PostHogOptions } from "posthog-node";
import { z } from "zod";
import {
  analyticsConfig,
  analyticsIdentity,
} from "@/server/observability/analytics";

export const marketingEventSchema = z
  .object({
    consent: z.literal(true),
    anonymousId: z.uuid(),
    viewId: z.uuid(),
    event: z.enum([
      "landing_viewed",
      "hero_cta_clicked",
      "pricing_viewed",
      "signup_started",
    ]),
    page: z.enum([
      "home",
      "pricing",
      "features",
      "workflow",
      "contact",
      "legal",
    ]),
    placement: z.enum(["page", "header", "hero", "pricing", "final", "footer"]),
  })
  .strict();
export type MarketingEventInput = z.infer<typeof marketingEventSchema>;
export function marketingAnalyticsEnabled() {
  return (
    process.env.MARKETING_ANALYTICS_ENABLED === "true" && !!analyticsConfig()
  );
}
const events = [
  "landing_viewed",
  "hero_cta_clicked",
  "pricing_viewed",
  "signup_started",
];
const propertiesSchema = marketingEventSchema.pick({
  page: true,
  placement: true,
});
export const scrubMarketingEvent: Exclude<
  NonNullable<PostHogOptions["before_send"]>,
  unknown[]
> = (event) => {
  const properties = propertiesSchema.safeParse(event.properties);
  if (
    !events.includes(event.event) ||
    !/^usr_[a-f0-9]{64}$/.test(event.distinctId ?? "") ||
    !properties.success
  )
    return null;
  return {
    event: event.event,
    distinctId: event.distinctId,
    ...(event.uuid ? { uuid: event.uuid } : {}),
    disableGeoip: true,
    sendFeatureFlags: false,
    properties: {
      ...properties.data,
      $geoip_disable: true,
      $process_person_profile: false,
    },
  };
};
let client: { key: string; sdk: PostHog } | undefined;
const seen = new Map<string, number>();
/** Anonymous opt-in events only; never reads an authenticated user or receives page text/URLs. */
export async function captureConsentedMarketingEvent(input: unknown) {
  const parsed = marketingEventSchema.safeParse(input),
    config = analyticsConfig();
  if (!parsed.success || !marketingAnalyticsEnabled() || !config) return;
  const value = parsed.data;
  if (
    (value.event === "landing_viewed" && value.page !== "home") ||
    (value.event === "hero_cta_clicked" && value.placement !== "hero")
  )
    return;
  const bytes = createHmac("sha256", config.secret)
    .update(JSON.stringify([value.viewId, value.event, value.placement]))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex"),
    uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const now = Date.now();
  for (const [id, expiry] of seen) if (expiry < now) seen.delete(id);
  if (seen.has(uuid)) return;
  if (seen.size >= 1000) return; // Bounded best-effort cache, never an autoscaling guarantee.
  seen.set(uuid, now + 10 * 60 * 1000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const key = JSON.stringify(config);
    if (client?.key !== key) {
      const sdk = new PostHog(config.token, {
        host: config.host,
        flushAt: 1,
        flushInterval: 0,
        maxQueueSize: 50,
        fetchRetryCount: 0,
        requestTimeout: 800,
        disableGeoip: true,
        enableExceptionAutocapture: false,
        before_send: scrubMarketingEvent,
      });
      sdk.on("error", () => {});
      client = { key, sdk };
    }
    await Promise.race([
      client.sdk.captureImmediate({
        event: value.event,
        distinctId: analyticsIdentity(`marketing:${value.anonymousId}`, config),
        uuid,
        disableGeoip: true,
        sendFeatureFlags: false,
        properties: {
          page: value.page,
          placement: value.placement,
          $process_person_profile: false,
        },
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 1000);
      }),
    ]);
  } catch {
    /* Conversion telemetry cannot break navigation, and provider errors are never exposed. */
  } finally {
    if (timer) clearTimeout(timer);
  }
}
