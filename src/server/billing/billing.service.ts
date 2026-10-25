import { captureBusinessEvent } from "@/server/observability/analytics";
import { observed } from "@/server/observability/operations";
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { InterviewError } from "@/server/ai/errors";
import { lockUsage } from "@/server/services/usage.service";
import { getUserPlan } from "@/server/services/subscription.service";
import { LemonSqueezyProvider } from "./providers/lemonsqueezy";
import type { BillingProvider, PaidPlan, RemoteSubscription } from "./provider";
import { billingConfig, safeLemonUrl } from "./config";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export type CheckoutBinding = { intentId: string; token: string; userId: string };
async function createBillingCheckoutCore(userId: string, plan: PaidPlan, provider: BillingProvider = new LemonSqueezyProvider()) {
  billingConfig();
  const token = randomBytes(32).toString("hex");
  const claim = await prisma.$transaction(async (tx) => {
    await lockUsage(tx, userId);
    const current = await getUserPlan(userId, tx);
    if (current.plan !== "FREE" || (current.subscription?.providerSubscriptionId && !["EXPIRED", "CANCELED"].includes(current.subscription.status))) throw new InterviewError("SUBSCRIPTION_EXISTS", 409, "Un abonnement existe déjà. Utilise sa gestion pour changer d’offre.");
    // A canceled, still-paid subscription must be resumed rather than duplicated.
    if (current.subscription?.providerSubscriptionId && current.subscription.currentPeriodEnd > new Date()) throw new InterviewError("SUBSCRIPTION_EXISTS", 409, "Ton abonnement est encore valable. Tu peux reprendre son renouvellement.");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const open = await tx.billingCheckoutIntent.findFirst({ where: { userId, expiresAt: { gt: new Date() }, state: { in: ["PENDING", "READY"] } }, orderBy: { createdAt: "desc" } });
    if (open) {
      if (open.plan === plan && open.state === "READY" && open.url) return { cached: true as const, url: safeLemonUrl(open.url) };
      throw new InterviewError("CHECKOUT_PENDING", 409, "Un checkout de test est déjà en cours. Termine-le ou attends son expiration avant de changer d’offre.");
    }
    const intent = await tx.billingCheckoutIntent.create({ data: { userId, plan, tokenHash: hash(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
    return { cached: false as const, intent, email: user.email };
  });
  if (claim.cached) return { url: claim.url, testMode: true };
  try {
    const checkout = await provider.createCheckout({ userId, email: claim.email, plan, intentId: claim.intent.id, token, expiresAt: claim.intent.expiresAt });
    await prisma.billingCheckoutIntent.update({ where: { id: claim.intent.id }, data: { state: "READY", providerCheckoutId: checkout.id, url: safeLemonUrl(checkout.url) } });
    return { url: safeLemonUrl(checkout.url), testMode: true };
  } catch (error) {
    // Keep the pending lease: a timed-out remote request may have created a checkout.
    // Reopening immediately could issue a second payable link.
    if (error instanceof InterviewError && error.code === "BILLING_INVALID_VARIANT") await prisma.billingCheckoutIntent.update({ where: { id: claim.intent.id }, data: { state: "FAILED" } });
    throw error;
  }
}
function validToken(value: string, digest: string) {
  return /^[a-f0-9]{64}$/.test(digest) && timingSafeEqual(Buffer.from(hash(value), "hex"), Buffer.from(digest, "hex"));
}
async function applyRemote(tx: Prisma.TransactionClient, userId: string, remote: RemoteSubscription): Promise<{ outcome: string; event: "subscription_activated" | "subscription_canceled" | null }> {
  const existing = await tx.subscription.findUnique({ where: { userId } });
  if (existing?.providerSubscriptionId && existing.providerSubscriptionId !== remote.id) {
    if ((existing.providerCreatedAt && remote.createdAt <= existing.providerCreatedAt) || existing.currentPeriodEnd > new Date()) return { outcome: "ignored_other_subscription", event: null };
  }
  if (existing?.providerSubscriptionId === remote.id && existing.providerRevision && BigInt(existing.providerRevision) >= BigInt(remote.revision)) return { outcome: "ignored_stale", event: null };
  const data = {
    plan: remote.plan, status: remote.status, provider: "LEMONSQUEEZY" as const,
    providerCustomerId: remote.customerId, providerSubscriptionId: remote.id, providerVariantId: remote.variantId,
    providerRevision: remote.revision, providerCreatedAt: remote.createdAt, providerTestMode: true,
    cancelAtPeriodEnd: remote.cancelAtPeriodEnd, accessEndsAt: remote.endsAt,
    currentPeriodStart: remote.periodStart, currentPeriodEnd: remote.periodEnd,
    // Enterprise overrides never carry over to an unrelated provider plan.
    limitOverrides: undefined,
  };
  await tx.subscription.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  const changedSubscription = existing?.providerSubscriptionId !== remote.id;
  const event = remote.cancelAtPeriodEnd && (!existing?.cancelAtPeriodEnd || changedSubscription) ? "subscription_canceled"
    : !remote.cancelAtPeriodEnd && ["ACTIVE", "TRIALING"].includes(remote.status) && remote.plan !== "FREE" &&
      (!existing || existing.cancelAtPeriodEnd || !["ACTIVE", "TRIALING"].includes(existing.status) || changedSubscription) ? "subscription_activated" : null;
  return { outcome: "synchronized", event };
}
async function synchronizeSubscriptionCore(remote: RemoteSubscription, event: { id: string; name: string; binding?: CheckoutBinding }) {
  const bound = await prisma.billingCheckoutIntent.findUnique({ where: { providerSubscriptionId: remote.id } });
  const existing = await prisma.subscription.findUnique({ where: { providerSubscriptionId: remote.id } });
  let intent = bound;
  if (!intent && !existing && event.binding) intent = await prisma.billingCheckoutIntent.findUnique({ where: { id: event.binding.intentId } });
  if (!intent && !existing) throw new InterviewError("BILLING_UNBOUND_SUBSCRIPTION", 422, "Cet abonnement ne peut pas être associé à un compte.");
  const userId = existing?.userId ?? intent!.userId;
  if (!bound && !existing && (!event.binding || !intent || intent.userId !== event.binding.userId || !validToken(event.binding.token, intent.tokenHash) || intent.providerSubscriptionId)) throw new InterviewError("BILLING_INVALID_BINDING", 422, "L’association du checkout est invalide.");
  if (!bound && !existing && intent && (remote.createdAt.getTime() < intent.createdAt.getTime() - 60000 || remote.createdAt.getTime() > intent.expiresAt.getTime() + 300000)) throw new InterviewError("BILLING_INVALID_BINDING", 422, "La date du checkout ne correspond pas à cet abonnement.");
  // A paid provider/store can never take over a subscription recorded under another provider.
  if (existing && existing.provider !== "LEMONSQUEEZY") throw new InterviewError("BILLING_PROVIDER_CONFLICT", 409, "Cet abonnement utilise un autre prestataire.");
  if (!bound && !existing && remote.plan === "FREE") throw new InterviewError("BILLING_UNSUPPORTED_VARIANT", 422, "Cette offre n’est pas prise en charge.");
  const outcome = await prisma.$transaction(async (tx) => {
    await lockUsage(tx, userId);
    if (await tx.billingWebhookEvent.findUnique({ where: { id: event.id } })) return { outcome: "duplicate", event: null };
    if (intent && !bound && !existing) {
      const fresh = await tx.billingCheckoutIntent.findUniqueOrThrow({ where: { id: intent.id } });
      if (fresh.providerSubscriptionId && fresh.providerSubscriptionId !== remote.id) throw new InterviewError("BILLING_INVALID_BINDING", 409, "Ce checkout est déjà associé à un abonnement.");
      await tx.billingCheckoutIntent.update({ where: { id: intent.id }, data: { providerSubscriptionId: remote.id, state: "CLAIMED", url: null } });
    }
    const outcome = await applyRemote(tx, userId, remote);
    await tx.billingWebhookEvent.create({ data: { id: event.id, eventName: event.name, providerSubscriptionId: remote.id, outcome: outcome.outcome } });
    return outcome;
  });
  try {
    if (outcome.event) await captureBusinessEvent(userId, outcome.event, `${remote.id}:${remote.revision}`, { plan: remote.plan });
  } catch { /* Analytics cannot invalidate a synchronized subscription. */ }
  return outcome.outcome;
}
async function manageBillingSubscriptionCore(userId: string, action: "cancel" | "resume" | "portal", provider: BillingProvider = new LemonSqueezyProvider()) {
  const row = await prisma.subscription.findUnique({ where: { userId } });
  if (!row?.providerSubscriptionId || row.provider !== "LEMONSQUEEZY" || !row.providerTestMode) throw new InterviewError("SUBSCRIPTION_NOT_FOUND", 404, "Aucun abonnement Lemon Squeezy de test à gérer.");
  const id = row.providerSubscriptionId;
  // Retrieve from the fixed API before any mutation, including mode/store validation.
  const verified = await provider.getSubscription(id);
  if (action === "portal") return { url: await provider.getCustomerPortalUrl(id) };
  if (action === "resume" && (!verified.cancelAtPeriodEnd || !verified.endsAt || verified.endsAt <= new Date())) throw new InterviewError("SUBSCRIPTION_NOT_RESUMABLE", 409, "Cet abonnement ne peut plus être repris. Consulte le portail client.");
  if (action === "cancel" && ["EXPIRED", "PAST_DUE"].includes(verified.status)) throw new InterviewError("SUBSCRIPTION_NOT_CANCELABLE", 409, "Consulte le portail pour gérer cet abonnement.");
  const remote = action === "cancel" ? await provider.cancelSubscription(id) : await provider.resumeSubscription(id);
  if ((action === "cancel" && !remote.cancelAtPeriodEnd) || (action === "resume" && (remote.cancelAtPeriodEnd || !["ACTIVE", "TRIALING"].includes(remote.status)))) throw new InterviewError("BILLING_ACTION_UNCONFIRMED", 503, "Le prestataire n’a pas encore confirmé cette modification. Actualise l’abonnement.");
  // Only verified provider responses change access; no browser plan or status is accepted.
  await synchronizeSubscription(remote, { id: hash(`${action}:${id}:${remote.revision}`), name: `api_${action}` });
  return { synchronized: true };
}
export async function billingSummary(userId: string) {
  const row = await prisma.subscription.findUnique({ where: { userId } });
  return { configuredSubscription: row?.provider === "LEMONSQUEEZY" && row.providerTestMode,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false, accessEndsAt: row?.accessEndsAt?.toISOString() ?? null,
    periodEnd: row?.currentPeriodEnd.toISOString() ?? null, testMode: row?.providerTestMode ?? false };
}

export const createBillingCheckout: typeof createBillingCheckoutCore = observed("billing", "checkout", createBillingCheckoutCore, (userId) => ({ userId }), async (result, userId, plan) => { await captureBusinessEvent(userId, "checkout_started", hash(result.url), { plan }); });

export const manageBillingSubscription: typeof manageBillingSubscriptionCore = observed("billing", "manage_subscription", manageBillingSubscriptionCore, (userId) => ({ userId }));

export const synchronizeSubscription: typeof synchronizeSubscriptionCore = observed("billing", "synchronize_subscription", synchronizeSubscriptionCore, () => ({}));
