import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { plans, planNames, resources, type Features, type Limits, type PlanName } from "@/config/plans";
const overridesSchema = z.object(Object.fromEntries(resources.map((key) => [key, z.number().int().min(0).max(1000000).nullable().optional()]))).strict();
export function calendarPeriod(now: Date) {
  return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}
export async function getUserSubscription(userId: string, db: Prisma.TransactionClient = prisma) {
  return db.subscription.findUnique({ where: { userId } });
}
export async function getUserPlan(userId: string, db: Prisma.TransactionClient = prisma, now = new Date()) {
  const subscription = await getUserSubscription(userId, db);
  const verifiedProvider = subscription?.provider === "STRIPE" || (subscription?.provider === "LEMONSQUEEZY" && subscription.providerTestMode && !!subscription.providerRevision);
  const eligible = subscription && planNames.includes(subscription.plan) && (["ACTIVE", "TRIALING"].includes(subscription.status) || (subscription.status === "CANCELED" && subscription.cancelAtPeriodEnd && subscription.provider === "LEMONSQUEEZY")) &&
    subscription.currentPeriodStart <= now && now < subscription.currentPeriodEnd && verifiedProvider && !!subscription.providerSubscriptionId;
  const plan: PlanName = eligible ? subscription.plan : "FREE";
  const limits = { ...plans[plan].limits };
  if (plan === "ENTERPRISE" && subscription?.limitOverrides) {
    const parsed = overridesSchema.safeParse(subscription.limitOverrides);
    // Invalid server configuration fails closed; never grants an unlimited plan.
    if (!parsed.success) throw new Error("Invalid Enterprise quota configuration");
    Object.assign(limits, parsed.data);
  }
  return { plan, limits, features: { ...plans[plan].features }, period: eligible ? { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd } : calendarPeriod(now), status: subscription?.status ?? "ACTIVE", subscription };
}
export async function getPlanLimits(userId: string): Promise<Limits> { return (await getUserPlan(userId)).limits; }
export async function getPlanFeatures(userId: string): Promise<Features> { return (await getUserPlan(userId)).features; }
export async function canAccessFeature(userId: string, feature: "markdown" | "codexPrompts" | "pdf") { return (await getPlanFeatures(userId))[feature]; }
