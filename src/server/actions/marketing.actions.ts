"use server";
import { captureConsentedMarketingEvent } from "@/server/marketing/analytics";
export async function trackMarketingEvent(input: unknown) {
  await captureConsentedMarketingEvent(input);
}
