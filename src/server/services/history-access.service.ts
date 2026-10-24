import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanFeatures } from "./subscription.service";
import { InterviewError } from "@/server/ai/errors";
export async function historyLimit(ownerId: string, db: Prisma.TransactionClient = prisma) { return (await getPlanFeatures(ownerId, db)).historyVersions ?? 50; }
export async function assertHistoryAccess(ownerId: string, projectId: string, kind: "brief" | "backlog", documentId: string, db: Prisma.TransactionClient = prisma) {
  const limit = (await getPlanFeatures(ownerId, db)).historyVersions;
  if (limit === null) return;
  const rows = kind === "brief" ? await db.brief.findMany({ where: { projectId, project: { ownerId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, select: { id: true } }) : await db.backlog.findMany({ where: { projectId, project: { ownerId } }, orderBy: { version: "desc" }, take: limit, select: { id: true } });
  if (!rows.some((row) => row.id === documentId)) throw new InterviewError("FEATURE_UNAVAILABLE", 403, "Le plan Free donne accès aux deux dernières versions. Consulte les offres pour accéder à l’historique complet.");
}
