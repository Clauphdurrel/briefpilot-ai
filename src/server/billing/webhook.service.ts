import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { InterviewError } from "@/server/ai/errors";
import { billingConfig } from "./config";
import { LemonSqueezyProvider } from "./providers/lemonsqueezy";
import type { BillingProvider } from "./provider";
import { synchronizeSubscription } from "./billing.service";
const events = new Set(["subscription_created", "subscription_updated", "subscription_cancelled", "subscription_expired", "subscription_resumed", "subscription_payment_success", "subscription_payment_failed", "subscription_payment_recovered", "subscription_paused", "subscription_unpaused"]);
const id = z.union([z.string().regex(/^[1-9]\d{0,17}$/), z.number().int().positive().safe()]).transform(String);
const schema = z.object({ meta: z.object({ event_name: z.string().min(1).max(100), custom_data: z.object({ user_id: z.string().min(1).max(128), checkout_intent_id: z.string().min(1).max(128), checkout_token: z.string().regex(/^[a-f0-9]{64}$/) }).optional() }), data: z.object({ id, type: z.enum(["subscriptions", "subscription-invoices"]), attributes: z.object({ test_mode: z.literal(true), subscription_id: id.optional() }) }) });
export function verifyWebhook(raw: Buffer, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(createHmac("sha256", secret).update(raw).digest(), Buffer.from(signature, "hex"))) throw new InterviewError("INVALID_WEBHOOK_SIGNATURE", 401, "Signature de webhook invalide.");
}
export async function handleLemonWebhook(raw: Buffer, signature: string | null, headerEvent?: string | null, provider: BillingProvider = new LemonSqueezyProvider()) {
  const config = billingConfig(); verifyWebhook(raw, signature, config.LEMONSQUEEZY_WEBHOOK_SECRET);
  let value: unknown; try { value = JSON.parse(raw.toString("utf8")); } catch { throw new InterviewError("INVALID_WEBHOOK", 400, "Webhook invalide."); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new InterviewError("INVALID_WEBHOOK", 400, "Webhook invalide ou hors du mode test.");
  const payload = parsed.data, name = payload.meta.event_name;
  if (headerEvent && headerEvent !== name) throw new InterviewError("INVALID_WEBHOOK", 400, "Événement incohérent.");
  if (!events.has(name)) return { outcome: "ignored_event" };
  const invoice = name.startsWith("subscription_payment_");
  if ((invoice && payload.data.type !== "subscription-invoices") || (!invoice && payload.data.type !== "subscriptions")) throw new InterviewError("INVALID_WEBHOOK", 400, "Type d’événement incohérent.");
  const subscriptionId = invoice ? payload.data.attributes.subscription_id : payload.data.id;
  if (!subscriptionId) throw new InterviewError("INVALID_WEBHOOK", 400, "Référence d’abonnement absente.");
  const eventId = createHash("sha256").update(raw).digest("hex");
  if (await prisma.billingWebhookEvent.findUnique({ where: { id: eventId } })) return { outcome: "duplicate" };
  const remote = await provider.getSubscription(subscriptionId);
  const custom = payload.meta.custom_data;
  return { outcome: await synchronizeSubscription(remote, { id: eventId, name, binding: custom ? { userId: custom.user_id, intentId: custom.checkout_intent_id, token: custom.checkout_token } : undefined }) };
}
