export const lemonEnv = {
  LEMONSQUEEZY_API_KEY: "local-test-key", LEMONSQUEEZY_STORE_ID: "100", LEMONSQUEEZY_WEBHOOK_SECRET: "local-test-secret-123456789",
  LEMONSQUEEZY_PRO_VARIANT_ID: "200", LEMONSQUEEZY_AGENCY_VARIANT_ID: "300", LEMONSQUEEZY_TEST_MODE: "true", AUTH_URL: "http://localhost:3000",
};
export function remoteFixture(status = "active") {
  return { data: { type: "subscriptions", id: "500", attributes: { store_id: 100, customer_id: 400, variant_id: 200, test_mode: true, status,
    cancelled: status === "cancelled", billing_anchor: 21, renews_at: "2026-11-21T10:00:00.000000Z", ends_at: status === "cancelled" || status === "expired" ? "2026-11-21T10:00:00.000000Z" : null, trial_ends_at: status === "on_trial" ? "2026-10-28T10:00:00.000000Z" : null,
    created_at: "2026-10-21T10:00:00.000000Z", updated_at: "2026-10-21T10:00:01.123456Z", urls: { customer_portal: "https://briefpilot.lemonsqueezy.com/billing?signature=test" } } } };
}
