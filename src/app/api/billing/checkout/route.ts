import { z } from "zod";
import { withBillingUser } from "@/server/http/billing";
import { readJsonBody } from "@/server/http/interview";
import { createBillingCheckout } from "@/server/billing/billing.service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return withBillingUser(request, async (userId) => {
    const { plan } = z.strictObject({ plan: z.enum(["PRO", "AGENCY"]) }).parse(await readJsonBody(request));
    return createBillingCheckout(userId, plan);
  });
}
