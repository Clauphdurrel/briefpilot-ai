import { beforeEach, expect, it, vi } from "vitest";
import { calendarPeriod, getUserPlan } from "../subscription.service";
import { plans } from "@/config/plans";
const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { subscription: { findUnique: read } } }));
const now = new Date("2026-10-21T12:00:00Z");
const row = () => ({ plan: "PRO", status: "ACTIVE", provider: "STRIPE", providerSubscriptionId: "sub-test", currentPeriodStart: new Date("2026-10-12T00:00:00Z"), currentPeriodEnd: new Date("2026-11-12T00:00:00Z") });
beforeEach(() => read.mockResolvedValue(null));
it("assigns FREE to a new account without fabricating payment or subscription", async () => {
  const result = await getUserPlan("user", undefined, now); expect(result.plan).toBe("FREE"); expect(result.subscription).toBeNull(); expect(result.limits.AI_INTERVIEW).toBe(3); expect(result.features.historyVersions).toBe(2);
});
it.each(["ACTIVE", "TRIALING"])("honors only server-provisioned eligible %s subscriptions", async (status) => {
  read.mockResolvedValue({ ...row(), status }); const result = await getUserPlan("user", undefined, now); expect(result.plan).toBe("PRO"); expect(result.period.start.toISOString()).toBe("2026-10-12T00:00:00.000Z");
});
it.each(["PAST_DUE", "CANCELED", "EXPIRED"])("falls back to FREE for %s without deleting data", async (status) => {
  read.mockResolvedValue({ ...row(), status }); expect((await getUserPlan("user", undefined, now)).plan).toBe("FREE");
});
it.each([{ provider: "NONE" }, { providerSubscriptionId: null }, { plan: "INVALID" }, { currentPeriodEnd: now }, { currentPeriodStart: new Date("2027-01-01") }])("rejects unsupported, unverified or out-of-period paid access: %j", async (change) => {
  read.mockResolvedValue({ ...row(), ...change }); expect((await getUserPlan("user", undefined, now)).plan).toBe("FREE");
});
it("uses stable calendar months in UTC including year/leap boundaries", () => {
  expect(calendarPeriod(new Date("2026-12-31T23:59:59Z")).end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  expect(calendarPeriod(new Date("2028-02-29T23:59:59Z")).start.toISOString()).toBe("2028-02-01T00:00:00.000Z");
});
it("represents unlimited explicitly and validates Enterprise server-only overrides", async () => {
  expect(plans.ENTERPRISE.limits.AI_BRIEF).toBeNull(); read.mockResolvedValue({ ...row(), plan: "ENTERPRISE", limitOverrides: { AI_BRIEF: 4, PDF_EXPORT: null } }); expect((await getUserPlan("user", undefined, now)).limits.AI_BRIEF).toBe(4);
  read.mockResolvedValue({ ...row(), plan: "ENTERPRISE", limitOverrides: { AI_BRIEF: -1 } }); await expect(getUserPlan("user", undefined, now)).rejects.toThrow();
});
