import "server-only";
import { z } from "zod";
import { InterviewError } from "@/server/ai/errors";
const id = z.string().regex(/^[1-9]\d{0,17}$/).refine((value) => Number.isSafeInteger(Number(value)));
const schema = z.object({
  LEMONSQUEEZY_API_KEY: z.string().trim().min(1), LEMONSQUEEZY_STORE_ID: id,
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().min(16), LEMONSQUEEZY_PRO_VARIANT_ID: id,
  LEMONSQUEEZY_AGENCY_VARIANT_ID: id, LEMONSQUEEZY_TEST_MODE: z.literal("true"),
  AUTH_URL: z.url().refine((value) => { const url = new URL(value); return !url.username && !url.password && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))); }),
}).refine((value) => value.LEMONSQUEEZY_PRO_VARIANT_ID !== value.LEMONSQUEEZY_AGENCY_VARIANT_ID);
export function billingConfig() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) throw new InterviewError("BILLING_NOT_CONFIGURED", 503, "Le paiement de test n’est pas encore configuré. Réessaie plus tard.");
  return parsed.data;
}
export const billingConfigured = () => schema.safeParse(process.env).success;
export function safeLemonUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !/^(?:[a-z0-9-]+\.)?lemonsqueezy\.com$/.test(url.hostname)) throw new InterviewError("BILLING_INVALID_RESPONSE", 502, "Le prestataire a renvoyé une réponse invalide.");
  return url.toString();
}
