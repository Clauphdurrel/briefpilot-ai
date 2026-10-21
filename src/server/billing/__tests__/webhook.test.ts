import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handleLemonWebhook, verifyWebhook } from "../webhook.service";
import { synchronizeSubscription } from "../billing.service";
import { lemonEnv } from "./fixtures";
const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { billingWebhookEvent: { findUnique: lookup } } }));
vi.mock("../billing.service", () => ({ synchronizeSubscription: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); lookup.mockResolvedValue(null); for (const [key, value] of Object.entries(lemonEnv)) vi.stubEnv(key, value); });
afterEach(() => vi.unstubAllEnvs());
const secret = lemonEnv.LEMONSQUEEZY_WEBHOOK_SECRET;
const sign = (raw: Buffer) => createHmac("sha256", secret).update(raw).digest("hex");
const payload = (name = "subscription_created") => Buffer.from(JSON.stringify({ meta: { event_name: name }, data: { type: name.startsWith("subscription_payment_") ? "subscription-invoices" : "subscriptions", id: "500", attributes: { test_mode: true, subscription_id: "500" } } }));
it.each([null, "", "wrong", "f".repeat(64), "ff"])("rejects an invalid signature before parsing or API access: %s", async (signature) => {
  const raw = payload(); expect(() => verifyWebhook(raw, signature, secret)).toThrow();
});
it("verifies exact raw bytes and does not accept a mutated body", () => { const raw = payload(); expect(() => verifyWebhook(raw, sign(raw), secret)).not.toThrow(); expect(() => verifyWebhook(Buffer.concat([raw, Buffer.from(" ")]), sign(raw), secret)).toThrow(); });
it("deduplicates before making a remote call", async () => {
  lookup.mockResolvedValue({ id: "existing" }); const get = vi.fn(); const raw = payload();
  expect(await handleLemonWebhook(raw, sign(raw), null, { getSubscription: get } as never)).toEqual({ outcome: "duplicate" }); expect(get).not.toHaveBeenCalled();
});
it.each(["subscription_created", "subscription_updated", "subscription_cancelled", "subscription_expired", "subscription_resumed", "subscription_payment_success", "subscription_payment_failed", "subscription_payment_recovered"])("fetches authoritative subscription for %s", async (name) => {
  const raw = payload(name), get = vi.fn().mockResolvedValue({ id: "500" }); vi.mocked(synchronizeSubscription).mockResolvedValue("synchronized");
  await handleLemonWebhook(raw, sign(raw), name, { getSubscription: get } as never); expect(get).toHaveBeenCalledWith("500"); expect(synchronizeSubscription).toHaveBeenCalled();
});
it("rejects a live-mode payload even with a valid signature", async () => {
  const raw = Buffer.from(payload().toString().replace('"test_mode":true', '"test_mode":false')); const get = vi.fn(); await expect(handleLemonWebhook(raw, sign(raw), null, { getSubscription: get } as never)).rejects.toMatchObject({ status: 400 }); expect(get).not.toHaveBeenCalled();
});
it("does not record or swallow provider errors, allowing a safe retry", async () => {
  const raw = payload(), get = vi.fn().mockRejectedValue(new Error("network")); await expect(handleLemonWebhook(raw, sign(raw), null, { getSubscription: get } as never)).rejects.toThrow(); expect(synchronizeSubscription).not.toHaveBeenCalled();
});
