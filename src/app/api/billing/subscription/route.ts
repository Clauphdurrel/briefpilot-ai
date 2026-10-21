import { z } from "zod";
import { withBillingUser } from "@/server/http/billing";
import { readJsonBody } from "@/server/http/interview";
import { billingSummary, manageBillingSubscription } from "@/server/billing/billing.service";
import { billingConfigured } from "@/server/billing/config";
import { getUserPlan } from "@/server/services/subscription.service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return withBillingUser(request, async (userId) => {
    const { plan, status } = await getUserPlan(userId);
    return { plan, status, configured: billingConfigured(), ...await billingSummary(userId) };
  });
}
export async function POST(request: Request) {
  return withBillingUser(request, async (userId) => {
    const { action } = z.strictObject({ action: z.enum(["cancel", "resume", "portal"]) }).parse(await readJsonBody(request));
    return manageBillingSubscription(userId, action);
  });
}
