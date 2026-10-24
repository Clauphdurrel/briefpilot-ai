import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBillingCheckout, synchronizeSubscription, manageBillingSubscription } from "../billing.service";
import { normalizeSubscription } from "../providers/lemonsqueezy";
import { getUserPlan } from "@/server/services/subscription.service";
import { reserveUsage, startUsage, commitUsage, getRemainingQuota } from "@/server/services/usage.service";
import { lemonEnv, remoteFixture } from "./fixtures";
import type { BillingProvider, CheckoutInput } from "../provider";
const users: string[] = [], subscriptions: string[] = [];
async function setup(plan: "PRO" | "AGENCY" = "PRO") {
  const id = randomUUID(); users.push(id); await prisma.user.create({ data: { id, email: `${id}@example.invalid` } });
  let input!: CheckoutInput;
  const provider = { createCheckout: vi.fn(async (value: CheckoutInput) => { input = value; return { id: randomUUID(), url: "https://briefpilot.lemonsqueezy.com/checkout/test" }; }) } as unknown as BillingProvider;
  await createBillingCheckout(id, plan, provider);
  const data = remoteFixture(), now = new Date(), end = new Date(now); end.setUTCMonth(end.getUTCMonth() + 1);
  const subscriptionId = String(Math.floor(Math.random() * 1e12) + 1); subscriptions.push(subscriptionId);
  data.data.id = subscriptionId; Object.assign(data.data.attributes, { variant_id: plan === "PRO" ? 200 : 300, created_at: now.toISOString(), updated_at: now.toISOString(), billing_anchor: now.getUTCDate(), renews_at: end.toISOString() });
  const remote = () => normalizeSubscription(data, subscriptionId);
  const event = () => ({ id: randomUUID(), name: "subscription_created", binding: { intentId: input.intentId, token: input.token, userId: id } });
  return { id, input, provider, data, remote, event };
}
describe.skipIf(process.env.LEMON_BILLING_INTEGRATION !== "1")("Billing PostgreSQL", () => {
  beforeEach(() => { for (const [key, value] of Object.entries(lemonEnv)) vi.stubEnv(key, value); });
  afterEach(async () => { await prisma.billingWebhookEvent.deleteMany({ where: { providerSubscriptionId: { in: subscriptions.splice(0) } } }); await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } }); vi.unstubAllEnvs(); });
  it.each(["PRO", "AGENCY"] as const)("grants %s only after remote verification and nonce-bound synchronization", async (plan) => {
    const value = await setup(plan); expect((await getUserPlan(value.id)).plan).toBe("FREE");
    await synchronizeSubscription(value.remote(), value.event()); expect((await getUserPlan(value.id)).plan).toBe(plan);
    expect((await prisma.billingCheckoutIntent.findUniqueOrThrow({ where: { id: value.input.intentId } })).url).toBeNull();
  });
  it("reuses an open checkout and refuses a second plan without issuing a second remote request", async () => {
    const value = await setup(); await createBillingCheckout(value.id, "PRO", value.provider); expect(value.provider.createCheckout).toHaveBeenCalledTimes(1);
    await expect(createBillingCheckout(value.id, "AGENCY", value.provider)).rejects.toMatchObject({ code: "CHECKOUT_PENDING" });
  });
  it("serializes two simultaneous requests for the same account", async () => {
    const id = randomUUID(); users.push(id); await prisma.user.create({ data: { id, email: `${id}@example.invalid` } });
    const provider = { createCheckout: vi.fn(async () => ({ id: randomUUID(), url: "https://briefpilot.lemonsqueezy.com/checkout/test" })) } as unknown as BillingProvider;
    const result = await Promise.allSettled([createBillingCheckout(id, "PRO", provider), createBillingCheckout(id, "PRO", provider)]);
    expect(result.filter((row) => row.status === "fulfilled").length).toBeGreaterThan(0); expect(provider.createCheckout).toHaveBeenCalledTimes(1); expect(await prisma.billingCheckoutIntent.count({ where: { userId: id } })).toBe(1);
  });
  it.each(["missing", "token", "user"])("refuses an invalid initial account binding: %s", async (mode) => {
    const value = await setup(), event = value.event(); if (mode === "missing") delete (event as { binding?: unknown }).binding; if (mode === "token") event.binding.token = "f".repeat(64); if (mode === "user") event.binding.userId = randomUUID();
    await expect(synchronizeSubscription(value.remote(), event)).rejects.toThrow(); expect((await getUserPlan(value.id)).plan).toBe("FREE");
  });
  it("deduplicates a webhook concurrently without multiple active subscriptions", async () => {
    const value = await setup(), event = value.event(); await Promise.all([synchronizeSubscription(value.remote(), event), synchronizeSubscription(value.remote(), event)]);
    expect(await prisma.subscription.count({ where: { userId: value.id } })).toBe(1); expect(await prisma.billingWebhookEvent.count({ where: { id: event.id } })).toBe(1);
  });
  it("never rolls state back when an older remote snapshot arrives last", async () => {
    const value = await setup(), old = value.remote();
    value.data.data.attributes.variant_id = 300; value.data.data.attributes.updated_at = new Date(Date.now() + 1000).toISOString(); await synchronizeSubscription(value.remote(), value.event());
    await synchronizeSubscription(old, value.event()); expect((await getUserPlan(value.id)).plan).toBe("AGENCY");
  });
  it("preserves paid access on cancellation until the stored provider end date", async () => {
    const value = await setup(); value.data.data.attributes.status = "cancelled"; value.data.data.attributes.cancelled = true; value.data.data.attributes.ends_at = value.data.data.attributes.renews_at;
    await synchronizeSubscription(value.remote(), value.event()); expect((await getUserPlan(value.id)).plan).toBe("PRO");
    await prisma.subscription.update({ where: { userId: value.id }, data: { currentPeriodEnd: new Date(Date.now() - 1) } }); expect((await getUserPlan(value.id)).plan).toBe("FREE");
  });
  it.each(["past_due", "unpaid", "expired", "paused"])("removes premium for verified %s without deleting data", async (status) => {
    const value = await setup(); await synchronizeSubscription(value.remote(), value.event()); value.data.data.attributes.status = status; value.data.data.attributes.updated_at = new Date(Date.now() + 1000).toISOString();
    if (status === "expired") value.data.data.attributes.ends_at = new Date().toISOString();
    await synchronizeSubscription(value.remote(), value.event()); expect((await getUserPlan(value.id)).plan).toBe("FREE"); expect(await prisma.subscription.count({ where: { userId: value.id } })).toBe(1);
  });
  it("preserves quota consumption on plan change and opens a genuinely new billing window", async () => {
    const value = await setup(); await synchronizeSubscription(value.remote(), value.event());
    const ticket = await reserveUsage(value.id, "AI_BRIEF", randomUUID()); await startUsage(ticket); await commitUsage(ticket); expect(await getRemainingQuota(value.id, "AI_BRIEF")).toBe(29);
    value.data.data.attributes.variant_id = 300; value.data.data.attributes.updated_at = new Date(Date.now() + 1000).toISOString(); await synchronizeSubscription(value.remote(), value.event()); expect(await getRemainingQuota(value.id, "AI_BRIEF")).toBe(149);
    await prisma.usageEvent.update({ where: { id: ticket.id }, data: { createdAt: new Date("2020-01-01") } }); expect(await getRemainingQuota(value.id, "AI_BRIEF")).toBe(150);
  });
  it("does not resurrect an older bound subscription after a new checkout replaces it", async () => {
    const value = await setup(); await synchronizeSubscription(value.remote(), value.event());
    await prisma.subscription.update({ where: { userId: value.id }, data: { status: "EXPIRED", currentPeriodEnd: new Date(Date.now() - 1) } });
    let nextInput!: CheckoutInput;
    const provider = { createCheckout: async (input: CheckoutInput) => { nextInput = input; return { id: randomUUID(), url: "https://briefpilot.lemonsqueezy.com/checkout/next" }; } } as BillingProvider;
    await createBillingCheckout(value.id, "AGENCY", provider);
    const next = structuredClone(value.data), nextId = String(Number(value.data.data.id) + 1); subscriptions.push(nextId);
    next.data.id = nextId; next.data.attributes.variant_id = 300; next.data.attributes.created_at = new Date(Date.now() + 1).toISOString(); next.data.attributes.updated_at = new Date(Date.now() + 2).toISOString();
    await synchronizeSubscription(normalizeSubscription(next, nextId), { id: randomUUID(), name: "subscription_created", binding: { intentId: nextInput.intentId, token: nextInput.token, userId: value.id } });
    await synchronizeSubscription(value.remote(), { id: randomUUID(), name: "subscription_updated" });
    const row = await prisma.subscription.findUniqueOrThrow({ where: { userId: value.id } }); expect(row.providerSubscriptionId).toBe(nextId); expect(row.plan).toBe("AGENCY");
  });
  it("does not allow management of another account subscription", async () => {
    const value = await setup(); await synchronizeSubscription(value.remote(), value.event()); const provider = { getSubscription: vi.fn() } as unknown as BillingProvider;
    await expect(manageBillingSubscription("foreign-user", "cancel", provider)).rejects.toMatchObject({ status: 404 }); expect(provider.getSubscription).not.toHaveBeenCalled();
  });
});
