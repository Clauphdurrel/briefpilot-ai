import type { SubscriptionStatus } from "@/generated/prisma/client";
export type PaidPlan = "PRO" | "AGENCY";
export type RemoteSubscription = {
  id: string; customerId: string; variantId: string; plan: PaidPlan | "FREE"; status: SubscriptionStatus;
  periodStart: Date; periodEnd: Date; cancelAtPeriodEnd: boolean; endsAt: Date | null;
  createdAt: Date; revision: string; testMode: true; portalUrl?: string;
};
export type CheckoutInput = { plan: PaidPlan; userId: string; email: string; intentId: string; token: string; expiresAt: Date };
export interface BillingProvider {
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  getSubscription(id: string): Promise<RemoteSubscription>;
  cancelSubscription(id: string): Promise<RemoteSubscription>;
  resumeSubscription(id: string): Promise<RemoteSubscription>;
  getCustomerPortalUrl(id: string): Promise<string>;
}
