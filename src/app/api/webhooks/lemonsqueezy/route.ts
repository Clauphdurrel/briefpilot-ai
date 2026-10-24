import { billingError, readRawWebhook } from "@/server/http/billing";
import { handleLemonWebhook } from "@/server/billing/webhook.service";
import { withOperation } from "@/server/observability/context";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return withOperation({ module: "billing" }, async () => {
    try {
      const result = await handleLemonWebhook(await readRawWebhook(request), request.headers.get("X-Signature"), request.headers.get("X-Event-Name"));
      return Response.json({ received: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return billingError(error); }
  });
}
