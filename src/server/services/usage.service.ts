import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resources, type Resource } from "@/config/plans";
import { InterviewError } from "@/server/ai/errors";
import { getUserPlan } from "./subscription.service";
export class QuotaError extends InterviewError {
  constructor(public resource: Resource, public limit: number, public used: number, public reserved: number) {
    super("QUOTA_EXCEEDED", 429, resource === "ACTIVE_PROJECTS" ? "La limite de projets actifs est atteinte. Archive un projet ou consulte les offres." : "Le quota de cette période est atteint. Consulte les offres ou attends la prochaine remise à zéro.");
  }
}
export type UsageTicket = { id: string; userId: string };
type Db = Prisma.TransactionClient;
export async function lockUsage(tx: Db, userId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`billing:${userId}`}, 0))`;
}
async function settle(tx: Db, id: string, status: "COMMITTED" | "RELEASED") {
  const event = await tx.usageEvent.findUniqueOrThrow({ where: { id } });
  if (!["RESERVED", "STARTED"].includes(event.status)) return;
  if (status === "RELEASED" && event.status === "STARTED" && event.resource !== "PDF_EXPORT") return;
  await tx.usageCounter.update({ where: { id: event.counterId }, data: { reserved: { decrement: event.units }, ...(status === "COMMITTED" ? { used: { increment: event.units } } : {}) } });
  await tx.usageEvent.update({ where: { id }, data: { status } });
}
async function recover(tx: Db, userId: string, now: Date) {
  const events = await tx.usageEvent.findMany({ where: { userId, status: { in: ["RESERVED", "STARTED"] }, leaseUntil: { lte: now } } });
  for (const event of events) await settle(tx, event.id, event.status === "STARTED" && event.resource !== "PDF_EXPORT" ? "COMMITTED" : "RELEASED");
}
async function totals(tx: Db, userId: string, resource: Resource, start: Date, end: Date) {
  // Event dates retain exact attribution across billing-period and plan changes.
  const rows = await tx.usageEvent.groupBy({ by: ["status"], where: { userId, resource, createdAt: { gte: start, lt: end }, status: { in: ["RESERVED", "STARTED", "COMMITTED"] } }, _sum: { units: true } });
  return rows.reduce((sum, item) => ({ used: sum.used + (item.status === "COMMITTED" ? item._sum.units ?? 0 : 0), reserved: sum.reserved + (item.status !== "COMMITTED" ? item._sum.units ?? 0 : 0) }), { used: 0, reserved: 0 });
}
export async function reserveUsage(userId: string, resource: Resource, operationId: string, transaction?: Db): Promise<UsageTicket> {
  z.enum(resources).parse(resource); z.string().min(1).max(250).parse(operationId);
  if (resource === "ACTIVE_PROJECTS") throw new Error("Active projects are capacity, not monthly usage");
  const run = async (tx: Db) => {
    await lockUsage(tx, userId); const now = new Date(); await recover(tx, userId, now);
    const existing = await tx.usageEvent.findUnique({ where: { userId_resource_operationId: { userId, resource, operationId } } });
    if (existing) throw new InterviewError("USAGE_OPERATION_REPLAY", 409, "Cette opération a déjà été traitée. Actualise le document avant de réessayer.");
    const plan = await getUserPlan(userId, tx, now), limit = plan.limits[resource];
    const count = await totals(tx, userId, resource, plan.period.start, plan.period.end);
    if (limit !== null && count.used + count.reserved >= limit) throw new QuotaError(resource, limit, count.used, count.reserved);
    const counter = await tx.usageCounter.upsert({ where: { userId_resource_periodStart_periodEnd: { userId, resource, periodStart: plan.period.start, periodEnd: plan.period.end } },
      create: { userId, resource, periodStart: plan.period.start, periodEnd: plan.period.end, reserved: 1 }, update: { reserved: { increment: 1 } } });
    const event = await tx.usageEvent.create({ data: { userId, resource, operationId, counterId: counter.id, createdAt: now, leaseUntil: new Date(now.getTime() + 120000) } });
    return { id: event.id, userId };
  };
  return transaction ? run(transaction) : prisma.$transaction(run);
}
export async function startUsage(ticket: UsageTicket) {
  return prisma.$transaction(async (tx) => {
    await lockUsage(tx, ticket.userId);
    const event = await tx.usageEvent.findFirst({ where: { id: ticket.id, userId: ticket.userId } });
    if (!event || event.status !== "RESERVED" || event.leaseUntil <= new Date()) throw new InterviewError("USAGE_RESERVATION_EXPIRED", 409, "La réservation a expiré. Relance la demande.");
    await tx.usageEvent.update({ where: { id: event.id }, data: { status: "STARTED" } });
  });
}
async function finish(ticket: UsageTicket, status: "COMMITTED" | "RELEASED") {
  await prisma.$transaction(async (tx) => { await lockUsage(tx, ticket.userId); const event = await tx.usageEvent.findFirst({ where: { id: ticket.id, userId: ticket.userId } }); if (event) await settle(tx, event.id, status); });
}
export const commitUsage = (ticket: UsageTicket) => finish(ticket, "COMMITTED");
export const releaseUsage = (ticket: UsageTicket) => finish(ticket, "RELEASED");
export async function withUsage<T>(ticket: UsageTicket, action: () => Promise<T>): Promise<T> {
  try { return await action(); } finally { await releaseUsage(ticket); }
}
export async function getUsage(userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockUsage(tx, userId); await recover(tx, userId, new Date());
    const plan = await getUserPlan(userId, tx);
    const usage = await Promise.all(resources.map(async (resource) => {
      const count = resource === "ACTIVE_PROJECTS" ? { used: await tx.project.count({ where: { ownerId: userId, status: { not: "ARCHIVED" } } }), reserved: 0 } : await totals(tx, userId, resource, plan.period.start, plan.period.end);
      const limit = plan.limits[resource];
      return { resource, ...count, limit, remaining: limit === null ? null : Math.max(0, limit - count.used - count.reserved) };
    }));
    return { plan: plan.plan, status: plan.status, periodStart: plan.period.start.toISOString(), periodEnd: plan.period.end.toISOString(), features: plan.features, usage };
  });
}
export async function getRemainingQuota(userId: string, resource: Resource) { return (await getUsage(userId)).usage.find((row) => row.resource === resource)!.remaining; }
export async function canPerformAction(userId: string, resource: Resource) { const remaining = await getRemainingQuota(userId, resource); return remaining === null || remaining > 0; }
export async function assertProjectCapacity(tx: Db, userId: string) {
  await lockUsage(tx, userId); const { limits } = await getUserPlan(userId, tx);
  const used = await tx.project.count({ where: { ownerId: userId, status: { not: "ARCHIVED" } } });
  if (limits.ACTIVE_PROJECTS !== null && used >= limits.ACTIVE_PROJECTS) throw new QuotaError("ACTIVE_PROJECTS", limits.ACTIVE_PROJECTS, used, 0);
}
