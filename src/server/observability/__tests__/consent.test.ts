import { beforeEach, expect, it, vi } from "vitest";
import { updateAnalyticsConsent } from "@/server/actions/analytics.actions";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/services/auth.service", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: mocks.update } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
beforeEach(() => { vi.resetAllMocks(); mocks.requireUser.mockResolvedValue({ id: "owner" }); mocks.update.mockResolvedValue({}); });
it.each([true, false])("persists consent=%s on the authenticated account only", async (consent) => {
  const form = new FormData(); if (consent) form.set("analyticsConsent", "on"); form.set("userId", "foreign-user");
  expect(await updateAnalyticsConsent({}, form)).toHaveProperty("message");
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "owner" }, data: { analyticsConsent: consent } });
});
it("rejects malformed checkbox values and preserves authentication redirects", async () => {
  const form = new FormData(); form.set("analyticsConsent", "true");
  expect(await updateAnalyticsConsent({}, form)).toHaveProperty("error"); expect(mocks.update).not.toHaveBeenCalled();
  const redirect = new Error("NEXT_REDIRECT"); mocks.requireUser.mockRejectedValueOnce(redirect);
  await expect(updateAnalyticsConsent({}, new FormData())).rejects.toBe(redirect);
});
it("does not expose persistence errors", async () => {
  mocks.update.mockRejectedValue(new Error("PRIVATE DATABASE URL"));
  const response = await updateAnalyticsConsent({}, new FormData()); expect(response.error).toBeTruthy(); expect(JSON.stringify(response)).not.toContain("PRIVATE");
});
