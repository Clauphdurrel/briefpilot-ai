import "server-only";
import { z } from "zod";
import { plans } from "@/config/plans";
import { InterviewError } from "@/server/ai/errors";
import { billingConfig, safeLemonUrl } from "../config";
import type { BillingProvider, CheckoutInput, RemoteSubscription } from "../provider";
import { readBodyBytes } from "@/server/http/read-body";
const providerId = z.union([z.string().regex(/^[1-9]\d{0,17}$/), z.number().int().positive().safe()]).transform(String);
const date = z.iso.datetime();
const subscriptionSchema = z.object({ data: z.object({ type: z.literal("subscriptions"), id: providerId, attributes: z.object({
  store_id: providerId, customer_id: providerId, variant_id: providerId, test_mode: z.literal(true),
  status: z.enum(["on_trial", "active", "paused", "past_due", "unpaid", "cancelled", "expired"]),
  cancelled: z.boolean(), billing_anchor: z.number().int().min(1).max(31),
  renews_at: date.nullable(), ends_at: date.nullable(), trial_ends_at: date.nullable(),
  created_at: date, updated_at: date,
  urls: z.object({ customer_portal: z.string().optional() }).optional(),
}) }) });
export function timestampRevision(value: string): string {
  const milliseconds = Date.parse(date.parse(value));
  const fraction = /\.(\d+)Z$/.exec(value)?.[1] ?? "";
  return (BigInt(Math.floor(milliseconds / 1000)) * BigInt(1000000000) + BigInt(fraction.padEnd(9, "0").slice(0, 9))).toString();
}
export function previousMonthlyAnchor(end: Date, anchor: number): Date {
  const result = new Date(end); result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() - 1);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(anchor, last)); return result;
}
export function normalizeSubscription(raw: unknown, expectedId: string, config = billingConfig()): RemoteSubscription {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) throw new InterviewError("BILLING_INVALID_RESPONSE", 502, "L’abonnement distant ne peut pas être vérifié.");
  const { id, attributes: a } = parsed.data.data;
  if (id !== expectedId || a.store_id !== config.LEMONSQUEEZY_STORE_ID) throw new InterviewError("BILLING_INVALID_RESPONSE", 502, "L’abonnement distant ne correspond pas à la boutique.");
  const plan = a.variant_id === config.LEMONSQUEEZY_PRO_VARIANT_ID ? "PRO" : a.variant_id === config.LEMONSQUEEZY_AGENCY_VARIANT_ID ? "AGENCY" : "FREE";
  const createdAt = new Date(a.created_at);
  const periodEnd = new Date((a.status === "on_trial" ? a.trial_ends_at : a.status === "cancelled" || a.status === "expired" ? a.ends_at : a.renews_at) ?? a.ends_at ?? a.updated_at);
  const previous = a.status === "on_trial" ? createdAt : previousMonthlyAnchor(periodEnd, a.billing_anchor);
  const periodStart = previous > createdAt ? previous : createdAt;
  const states = { active: "ACTIVE", on_trial: "TRIALING", cancelled: "CANCELED", expired: "EXPIRED", past_due: "PAST_DUE", unpaid: "PAST_DUE", paused: "PAST_DUE" } as const;
  const status = plan === "FREE" ? "EXPIRED" : states[a.status];
  if (["ACTIVE", "TRIALING", "CANCELED"].includes(status) && periodStart >= periodEnd) throw new InterviewError("BILLING_INVALID_PERIOD", 502, "La période de l’abonnement distant est invalide.");
  return { id, customerId: a.customer_id, variantId: a.variant_id, plan, status, periodStart, periodEnd,
    cancelAtPeriodEnd: a.cancelled || a.status === "cancelled", endsAt: a.ends_at ? new Date(a.ends_at) : null,
    createdAt, revision: timestampRevision(a.updated_at), testMode: true,
    portalUrl: a.urls?.customer_portal ? safeLemonUrl(a.urls.customer_portal) : undefined };
}
export class LemonSqueezyProvider implements BillingProvider {
  constructor(private readonly transport: typeof fetch = fetch) {}
  private async api(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const config = billingConfig();
    try {
      const response = await this.transport(`https://api.lemonsqueezy.com/v1/${path}`, { method, headers: { Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json", Authorization: `Bearer ${config.LEMONSQUEEZY_API_KEY}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store" });
      if (!response.ok) throw new Error("Provider unavailable");
      if (!response.body) throw new Error("Empty provider response");
      const bytes = await readBodyBytes(response.body, 512000);
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch { throw new InterviewError("BILLING_PROVIDER_UNAVAILABLE", 503, "Le prestataire de paiement est momentanément indisponible. Réessaie."); }
  }
  async createCheckout(input: CheckoutInput) {
    const config = billingConfig(), variant = input.plan === "PRO" ? config.LEMONSQUEEZY_PRO_VARIANT_ID : config.LEMONSQUEEZY_AGENCY_VARIANT_ID;
    // Restrict this MVP to monthly, fixed-price variants from the configured test store.
    const store = z.object({ data: z.object({ id: providerId, attributes: z.object({ currency: z.literal("EUR") }) }) }).safeParse(await this.api(`stores/${config.LEMONSQUEEZY_STORE_ID}`));
    if (!store.success || store.data.data.id !== config.LEMONSQUEEZY_STORE_ID) throw new InterviewError("BILLING_INVALID_VARIANT", 503, "La boutique de test doit utiliser la devise EUR.");
    const variantSchema = z.object({ data: z.object({ id: providerId, attributes: z.object({ product_id: providerId, test_mode: z.literal(true), is_subscription: z.literal(true), interval: z.literal("month"), interval_count: z.literal(1), price: z.number().int().refine((value) => value === plans[input.plan].monthlyPriceEuro! * 100), pay_what_you_want: z.literal(false) }) }) });
    const verified = variantSchema.safeParse(await this.api(`variants/${variant}`));
    if (!verified.success || verified.data.data.id !== variant) throw new InterviewError("BILLING_INVALID_VARIANT", 503, "L’offre de test n’est pas correctement configurée.");
    const product = z.object({ data: z.object({ attributes: z.object({ store_id: providerId, test_mode: z.literal(true) }) }) }).safeParse(await this.api(`products/${verified.data.data.attributes.product_id}`));
    if (!product.success || product.data.data.attributes.store_id !== config.LEMONSQUEEZY_STORE_ID) throw new InterviewError("BILLING_INVALID_VARIANT", 503, "L’offre ne correspond pas à la boutique de test.");
    const result = await this.api("checkouts", "POST", { data: { type: "checkouts", attributes: {
      test_mode: true, expires_at: input.expiresAt.toISOString(), checkout_options: { embed: false, locale: "fr" },
      product_options: { enabled_variants: [Number(variant)], redirect_url: new URL("/dashboard/billing/success", config.AUTH_URL).toString() },
      checkout_data: { email: input.email, custom: { user_id: input.userId, checkout_intent_id: input.intentId, checkout_token: input.token } },
    }, relationships: { store: { data: { type: "stores", id: config.LEMONSQUEEZY_STORE_ID } }, variant: { data: { type: "variants", id: variant } } } } });
    const parsed = z.object({ data: z.object({ type: z.literal("checkouts"), id: z.string().min(1).max(150), attributes: z.object({ test_mode: z.literal(true), url: z.string() }) }) }).safeParse(result);
    if (!parsed.success) throw new InterviewError("BILLING_INVALID_RESPONSE", 502, "Le checkout de test n’a pas pu être vérifié.");
    return { id: parsed.data.data.id, url: safeLemonUrl(parsed.data.data.attributes.url) };
  }
  async getSubscription(id: string) { return normalizeSubscription(await this.api(`subscriptions/${providerId.parse(id)}`), id); }
  async cancelSubscription(id: string) { await this.api(`subscriptions/${providerId.parse(id)}`, "DELETE"); return this.getSubscription(id); }
  async resumeSubscription(id: string) { await this.api(`subscriptions/${providerId.parse(id)}`, "PATCH", { data: { type: "subscriptions", id, attributes: { cancelled: false } } }); return this.getSubscription(id); }
  async getCustomerPortalUrl(id: string) {
    const subscription = await this.getSubscription(id);
    if (!subscription.portalUrl) throw new InterviewError("BILLING_PORTAL_UNAVAILABLE", 503, "Le portail client n’est pas disponible pour cet abonnement.");
    return subscription.portalUrl;
  }
}
