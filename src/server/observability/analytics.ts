import "server-only";
import { createHmac } from "node:crypto";
import { PostHog, type PostHogOptions } from "posthog-node";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logEvent } from "./logger";

export const businessEvents = ["user_signed_in", "project_created", "interview_started", "interview_completed", "brief_generated", "backlog_generated", "markdown_exported", "pdf_exported", "checkout_started", "subscription_activated", "subscription_canceled", "quota_exceeded"] as const;
export type BusinessEvent = typeof businessEvents[number];
const propertiesSchema = z.object({
  plan: z.enum(["FREE", "PRO", "AGENCY", "ENTERPRISE"]).optional(),
  resource: z.enum(["ACTIVE_PROJECTS", "AI_INTERVIEW", "AI_BRIEF", "AI_BACKLOG", "PDF_EXPORT"]).optional(),
  documentKind: z.enum(["brief", "backlog", "codex", "project"]).optional(),
  durationMs: z.number().finite().nonnegative().optional(),
});
type Properties = z.infer<typeof propertiesSchema>;
const configSchema = z.object({
  token: z.string().min(1), host: z.enum(["https://eu.i.posthog.com", "https://us.i.posthog.com"]),
  secret: z.string().min(32), environment: z.enum(["development", "staging", "production"]),
});
export function analyticsConfig() {
  if (process.env.OBSERVABILITY_ENABLED !== "true" || process.env.POSTHOG_ENABLED !== "true" || process.env.NODE_ENV === "test" ||
    [process.env.OBSERVABILITY_TEST_MODE, process.env.E2E_TEST, process.env.PLAYWRIGHT_TEST].some((value) => value === "true" || value === "1")) return null;
  const parsed = configSchema.safeParse({ token: process.env.POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    host: process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST, secret: process.env.ANALYTICS_HMAC_SECRET, environment: process.env.OBSERVABILITY_ENVIRONMENT });
  if (!parsed.success || (parsed.data.environment === "production" && process.env.NODE_ENV !== "production")) return null;
  return parsed.data;
}
type Config = NonNullable<ReturnType<typeof analyticsConfig>>;
const pseudonym = /^usr_[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function analyticsIdentity(userId: string, config: Config) {
  return `usr_${createHmac("sha256", config.secret).update(`${config.environment}:user:${userId}`).digest("hex")}`;
}
function eventUuid(userId: string, event: BusinessEvent, key: string, config: Config) {
  const bytes = createHmac("sha256", config.secret).update(JSON.stringify([config.environment, userId, event, key])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const scrubAnalyticsEvent: Exclude<NonNullable<PostHogOptions["before_send"]>, unknown[]> = (event) => {
  if (!(businessEvents as readonly string[]).includes(event.event) || !event.distinctId || !pseudonym.test(event.distinctId)) return null;
  const parsed = propertiesSchema.safeParse(event.properties ?? {});
  if (!parsed.success) return null;
  const source = event.properties ?? {}, properties: Record<string, string | number | boolean> = {
    ...parsed.data, $geoip_disable: true, $process_person_profile: false,
  };
  if (["development", "staging", "production"].includes(String(source.environment))) properties.environment = String(source.environment);
  if (typeof source.$insert_id === "string" && uuidPattern.test(source.$insert_id)) properties.$insert_id = source.$insert_id;
  return { event: event.event, distinctId: event.distinctId, disableGeoip: true, sendFeatureFlags: false,
    ...(event.uuid && uuidPattern.test(event.uuid) ? { uuid: event.uuid } : {}), properties, ...(event.timestamp instanceof Date ? { timestamp: event.timestamp } : {}) };
};
let client: { config: string; sdk: PostHog } | undefined;
function getClient(config: Config) {
  const key = JSON.stringify(config);
  if (client?.config !== key) {
    const sdk = new PostHog(config.token, { host: config.host, flushAt: 1, flushInterval: 0, maxQueueSize: 100,
      fetchRetryCount: 0, requestTimeout: 800, disableGeoip: true, enableExceptionAutocapture: false,
      before_send: scrubAnalyticsEvent });
    sdk.on("error", () => { try { logEvent("analytics_unavailable", { errorCode: "ANALYTICS_UNAVAILABLE", status: "error" }, "warn"); } catch { /* Best effort. */ } });
    client = { config: key, sdk };
  }
  return client.sdk;
}

/** Server facts only. No browser SDK, pageviews, forms, replay or person profile. */
export async function captureBusinessEvent(userId: string, event: BusinessEvent, key: string, properties: Properties = {}) {
  const config = analyticsConfig();
  if (!config) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  try {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(userId) || !(businessEvents as readonly string[]).includes(event) || key.length > 300) return;
    const safeProperties = propertiesSchema.parse(properties);
    await Promise.race([(async () => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { analyticsConsent: true } });
      if (!user?.analyticsConsent || expired || !analyticsConfig()) return;
      const uuid = eventUuid(userId, event, key, config);
      await getClient(config).captureImmediate({ event, distinctId: analyticsIdentity(userId, config), uuid, disableGeoip: true, sendFeatureFlags: false,
        properties: { ...safeProperties, environment: config.environment, $insert_id: uuid, $process_person_profile: false } });
    })(), new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error("Analytics deadline")); }, 1000); })]);
  } catch { try { logEvent("analytics_unavailable", { errorCode: "ANALYTICS_UNAVAILABLE", status: "error" }, "warn"); } catch { /* Best effort. */ } }
  finally { if (timer) clearTimeout(timer); }
}
