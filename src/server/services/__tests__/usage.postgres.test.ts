import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { reserveUsage, startUsage, commitUsage, releaseUsage, getUsage, getRemainingQuota } from "../usage.service";
import { createOwnedProject, setProjectArchived } from "../project.service";
import { runMetered, meterProvider } from "@/server/ai/usage-context";
const ids: string[] = [];
async function user() { const id = randomUUID(); ids.push(id); await prisma.user.create({ data: { id, email: `${id}@example.invalid` } }); return id; }
const input = { name: "Projet de test", type: "WEBSITE" as const, description: "" };
describe.skipIf(process.env.BILLING_INTEGRATION !== "1")("PostgreSQL quotas atomiques", () => {
  afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
  it("returns zero actual usage and Free limits for a new user", async () => {
    const id = await user(), usage = await getUsage(id); expect(usage.plan).toBe("FREE"); expect(usage.usage.every((item) => item.used === 0 && item.reserved === 0)).toBe(true);
  });
  it("atomically reserves only one of ten concurrent backlog operations", async () => {
    const id = await user(), results = await Promise.allSettled(Array.from({ length: 10 }, () => reserveUsage(id, "AI_BACKLOG", randomUUID())));
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1); expect(await getRemainingQuota(id, "AI_BACKLOG")).toBe(0);
    expect(await prisma.usageEvent.count({ where: { userId: id } })).toBe(1);
  });
  it("rejects a repeated operation without a second reservation/debit", async () => {
    const id = await user(), operation = randomUUID(), ticket = await reserveUsage(id, "AI_BRIEF", operation);
    await startUsage(ticket); await commitUsage(ticket); await commitUsage(ticket);
    await expect(reserveUsage(id, "AI_BRIEF", operation)).rejects.toMatchObject({ code: "USAGE_OPERATION_REPLAY" });
    const counter = await prisma.usageCounter.findFirstOrThrow({ where: { userId: id } }); expect(counter.used).toBe(1); expect(counter.reserved).toBe(0);
  });
  it("releases an admissible pre-dispatch failure", async () => {
    const id = await user(), ticket = await reserveUsage(id, "AI_INTERVIEW", randomUUID());
    await expect(runMetered(ticket, async () => { throw new Error("invalid context"); })).rejects.toThrow(); expect(await getRemainingQuota(id, "AI_INTERVIEW")).toBe(3);
  });
  it("charges a dispatched provider failure exactly once", async () => {
    const id = await user(), ticket = await reserveUsage(id, "AI_INTERVIEW", randomUUID()); let calls = 0;
    await expect(runMetered(ticket, () => meterProvider(async () => { calls++; throw new Error("simulated provider failure"); }))).rejects.toThrow();
    expect(calls).toBe(1); expect(await getRemainingQuota(id, "AI_INTERVIEW")).toBe(2); await releaseUsage(ticket); expect(await getRemainingQuota(id, "AI_INTERVIEW")).toBe(2);
  });
  it("rejects exhausted usage before invoking a simulated provider", async () => {
    const id = await user(); let calls = 0;
    const invoke = async () => { const ticket = await reserveUsage(id, "AI_BACKLOG", randomUUID()); await runMetered(ticket, () => meterProvider(async () => { calls++; })); };
    await invoke(); await expect(invoke()).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", resource: "AI_BACKLOG", limit: 1, used: 1 }); expect(calls).toBe(1);
  });
  it.each([false, true])("recovers an abandoned reservation conservatively (started=%s)", async (started) => {
    const id = await user(), ticket = await reserveUsage(id, "AI_BACKLOG", randomUUID()); if (started) await startUsage(ticket);
    await prisma.usageEvent.update({ where: { id: ticket.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    const row = (await getUsage(id)).usage.find((item) => item.resource === "AI_BACKLOG")!; expect(row.reserved).toBe(0); expect(row.used).toBe(started ? 1 : 0);
  });
  it("refuses to start an expired reservation before any provider call", async () => {
    const id = await user(), ticket = await reserveUsage(id, "AI_INTERVIEW", randomUUID()); await prisma.usageEvent.update({ where: { id: ticket.id }, data: { leaseUntil: new Date(0) } }); await expect(startUsage(ticket)).rejects.toMatchObject({ code: "USAGE_RESERVATION_EXPIRED" });
  });
  it("releases failed PDF rendering without consuming an AI unit", async () => {
    const id = await user(), ticket = await reserveUsage(id, "PDF_EXPORT", randomUUID()); await startUsage(ticket); await releaseUsage(ticket); expect(await getRemainingQuota(id, "PDF_EXPORT")).toBe(3); expect(await getRemainingQuota(id, "AI_BRIEF")).toBe(2);
  });
  it("ignores events from the preceding calendar month without deleting history", async () => {
    const id = await user(), ticket = await reserveUsage(id, "AI_BACKLOG", randomUUID()); await startUsage(ticket); await commitUsage(ticket);
    await prisma.usageEvent.update({ where: { id: ticket.id }, data: { createdAt: new Date("2020-01-01") } }); expect(await getRemainingQuota(id, "AI_BACKLOG")).toBe(1); expect(await prisma.usageEvent.count({ where: { userId: id } })).toBe(1);
  });
  it("limits concurrent project creation and reactivation while excluding archived projects", async () => {
    const id = await user(), results = await Promise.allSettled(Array.from({ length: 5 }, () => createOwnedProject(id, input))); expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(2);
    const project = await prisma.project.findFirstOrThrow({ where: { ownerId: id } }); await setProjectArchived(id, project.id, true); await createOwnedProject(id, input);
    await expect(setProjectArchived(id, project.id, false)).rejects.toMatchObject({ resource: "ACTIVE_PROJECTS" }); expect(await prisma.project.count({ where: { ownerId: id } })).toBe(3);
  });
  it("does not erase projects or reset this-month consumption on downgrade", async () => {
    const id = await user(), start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0); const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
    await prisma.subscription.create({ data: { userId: id, plan: "PRO", status: "TRIALING", provider: "STRIPE", providerSubscriptionId: `test_${id}`, currentPeriodStart: start, currentPeriodEnd: end } });
    for (let i = 0; i < 3; i++) { await createOwnedProject(id, input); const ticket = await reserveUsage(id, "AI_BRIEF", randomUUID()); await startUsage(ticket); await commitUsage(ticket); }
    await prisma.subscription.update({ where: { userId: id }, data: { status: "CANCELED" } });
    expect((await getUsage(id)).plan).toBe("FREE"); expect(await prisma.project.count({ where: { ownerId: id } })).toBe(3);
    await expect(createOwnedProject(id, input)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" }); await expect(reserveUsage(id, "AI_BRIEF", randomUUID())).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });
  it("prevents ticket settlement by a different owner", async () => {
    const id = await user(), other = await user(), ticket = await reserveUsage(id, "AI_BRIEF", randomUUID()); await releaseUsage({ ...ticket, userId: other }); expect(await getRemainingQuota(id, "AI_BRIEF")).toBe(1);
  });
});
