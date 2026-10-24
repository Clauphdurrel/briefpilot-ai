import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { billingConfig, safeLemonUrl } from "../config";
import { LemonSqueezyProvider, normalizeSubscription, previousMonthlyAnchor, timestampRevision } from "../providers/lemonsqueezy";
import { lemonEnv, remoteFixture } from "./fixtures";
beforeEach(() => { for (const [key, value] of Object.entries(lemonEnv)) vi.stubEnv(key, value); });
afterEach(() => vi.unstubAllEnvs());
it.each(["false", "", "TRUE"])("refuses any non-explicit test configuration %s", (mode) => { vi.stubEnv("LEMONSQUEEZY_TEST_MODE", mode); expect(billingConfig).toThrow(); });
it.each(["http://briefpilot.lemonsqueezy.com", "https://evil.example/", "https://lemonsqueezy.com.evil.example/", "https://user:password@lemonsqueezy.com", "javascript:alert(1)"])("refuses unsafe redirect %s", (url) => { expect(() => safeLemonUrl(url)).toThrow(); });
it.each(["active", "on_trial", "past_due", "unpaid", "paused", "cancelled", "expired"])("maps remote status %s without inventing a paid period", (status) => {
  const result = normalizeSubscription(remoteFixture(status), "500");
  const expected = { active: "ACTIVE", on_trial: "TRIALING", past_due: "PAST_DUE", unpaid: "PAST_DUE", paused: "PAST_DUE", cancelled: "CANCELED", expired: "EXPIRED" };
  expect(result.status).toBe(expected[status as keyof typeof expected]); expect(result.testMode).toBe(true); expect(result.periodStart.toISOString()).toBe("2026-10-21T10:00:00.000Z");
});
it("handles month end anchors without losing the 31st after February", () => {
  expect(previousMonthlyAnchor(new Date("2027-02-28T10:00:00Z"), 31).toISOString()).toBe("2027-01-31T10:00:00.000Z");
  expect(previousMonthlyAnchor(new Date("2028-03-31T10:00:00Z"), 31).toISOString()).toBe("2028-02-29T10:00:00.000Z");
});
it("retains microsecond ordering rather than truncating to database milliseconds", () => { expect(BigInt(timestampRevision("2026-10-21T10:00:01.123457Z"))).toBeGreaterThan(BigInt(timestampRevision("2026-10-21T10:00:01.123456Z"))); });
it.each(["mode", "store", "id", "period"])("rejects an unverifiable subscription: %s", (field) => {
  const raw = remoteFixture(); if (field === "mode") raw.data.attributes.test_mode = false; if (field === "store") raw.data.attributes.store_id = 999; if (field === "id") raw.data.id = "501"; if (field === "period") raw.data.attributes.renews_at = raw.data.attributes.created_at;
  expect(() => normalizeSubscription(raw, "500")).toThrow();
});
it("revokes premium for a bound remote subscription moved to an unsupported variant", () => { const raw = remoteFixture(); raw.data.attributes.variant_id = 999; expect(normalizeSubscription(raw, "500")).toMatchObject({ plan: "FREE", status: "EXPIRED" }); });
it.each(["PRO", "AGENCY"] as const)("creates a verified %s checkout with fixed variant, test mode and server custom data", async (plan) => {
  const variant = plan === "PRO" ? "200" : "300";
  const responses = [
    { data: { id: "100", attributes: { currency: "EUR" } } },
    { data: { id: variant, attributes: { product_id: 10, test_mode: true, is_subscription: true, interval: "month", interval_count: 1, price: plan === "PRO" ? 1900 : 5900, pay_what_you_want: false } } },
    { data: { attributes: { store_id: 100, test_mode: true } } },
    { data: { type: "checkouts", id: "checkout-id", attributes: { test_mode: true, url: "https://briefpilot.lemonsqueezy.com/checkout/test" } } },
  ];
  const transport = vi.fn<typeof fetch>(async () => Response.json(responses.shift()));
  const provider = new LemonSqueezyProvider(transport as typeof fetch);
  await provider.createCheckout({ plan, userId: "owner", email: "owner@example.invalid", intentId: "intent", token: "a".repeat(64), expiresAt: new Date("2026-10-21T11:00:00Z") });
  const options = transport.mock.calls[3] as unknown as [string, RequestInit]; const data = JSON.parse(options[1].body as string).data;
  expect(data.attributes.test_mode).toBe(true); expect(data.relationships.variant.data.id).toBe(variant); expect(data.attributes.custom_price).toBeUndefined(); expect(data.attributes.checkout_data.custom).toMatchObject({ user_id: "owner", checkout_intent_id: "intent" }); expect(data.attributes.product_options.redirect_url).toBe("http://localhost:3000/dashboard/billing/success");
});
it("sanitizes API failures and disallows following redirects", async () => {
  const transport = vi.fn<typeof fetch>(async () => new Response("private-secret", { status: 500 }));
  await expect(new LemonSqueezyProvider(transport).getSubscription("500")).rejects.toMatchObject({ code: "BILLING_PROVIDER_UNAVAILABLE" }); expect(transport.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store" });
});
it("cancels oversized provider streams before concatenation and keeps the error public", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(256000)); c.enqueue(new Uint8Array(256001)); }, cancel });
  const transport = vi.fn<typeof fetch>(async () => new Response(body));
  await expect(new LemonSqueezyProvider(transport).getSubscription("500")).rejects.toMatchObject({ code: "BILLING_PROVIDER_UNAVAILABLE", status: 503 });
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});
