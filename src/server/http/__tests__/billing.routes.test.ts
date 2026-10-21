import { beforeEach, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createBillingCheckout, manageBillingSubscription, billingSummary } from "@/server/billing/billing.service";
import { GET, POST } from "@/app/api/billing/subscription/route";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { InterviewError } from "@/server/ai/errors";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/server/billing/billing.service", () => ({ createBillingCheckout: vi.fn(), manageBillingSubscription: vi.fn(), billingSummary: vi.fn() }));
vi.mock("@/server/billing/config", () => ({ billingConfigured: () => true }));
vi.mock("@/server/services/subscription.service", () => ({ getUserPlan: async () => ({ plan: "FREE", status: "ACTIVE" }) }));
const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(auth).mockResolvedValue({ user: { email: "owner@example.invalid" } } as never); vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner" } as never);
  vi.mocked(createBillingCheckout).mockResolvedValue({ url: "https://briefpilot.lemonsqueezy.com/checkout/test", testMode: true });
  vi.mocked(manageBillingSubscription).mockResolvedValue({ synchronized: true }); vi.mocked(billingSummary).mockResolvedValue({ configuredSubscription: false, cancelAtPeriodEnd: false, accessEndsAt: null, periodEnd: null, testMode: false });
});
it.each(["PRO", "AGENCY"])("uses the authenticated account and approved plan %s", async (plan) => {
  const response = await checkout(request({ plan })); expect(response.status).toBe(200); expect(createBillingCheckout).toHaveBeenCalledWith("owner", plan); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it.each([{ plan: "FREE" }, { plan: "ENTERPRISE" }, { plan: "PRO", variantId: "123" }, { plan: "PRO", price: 1 }, { plan: "AGENCY", userId: "victim" }])("refuses arbitrary client billing data: %j", async (body) => {
  expect((await checkout(request(body))).status).toBe(400); expect(createBillingCheckout).not.toHaveBeenCalled();
});
it("requires auth and same-origin mutations", async () => {
  expect((await checkout(request({ plan: "PRO" }, "https://evil.example"))).status).toBe(403); vi.mocked(auth).mockResolvedValue(null as never); expect((await checkout(request({ plan: "PRO" }))).status).toBe(401); expect(createBillingCheckout).not.toHaveBeenCalled();
});
it("does not change access on a GET or URL parameters", async () => {
  const response = await GET(new Request("http://localhost/api/billing/subscription?plan=ENTERPRISE&paid=true")); expect((await response.json()).data.plan).toBe("FREE"); expect(createBillingCheckout).not.toHaveBeenCalled(); expect(manageBillingSubscription).not.toHaveBeenCalled();
});
it.each(["cancel", "resume", "portal"])("accepts only the current account action %s", async (action) => {
  expect((await POST(request({ action }))).status).toBe(200); expect(manageBillingSubscription).toHaveBeenCalledWith("owner", action);
});
it("rejects another user's subscription identifier", async () => { expect((await POST(request({ action: "cancel", subscriptionId: "foreign" }))).status).toBe(400); expect(manageBillingSubscription).not.toHaveBeenCalled(); });
it("preserves a public configuration error but hides internal provider details", async () => {
  vi.mocked(createBillingCheckout).mockRejectedValueOnce(new InterviewError("BILLING_NOT_CONFIGURED", 503, "Paiement indisponible.")); expect((await checkout(request({ plan: "PRO" }))).status).toBe(503);
  vi.mocked(createBillingCheckout).mockRejectedValueOnce(new Error("private-api-secret")); const response = await checkout(request({ plan: "PRO" })); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private-api-secret");
});
