import "server-only";
import { prisma } from "@/lib/prisma";
import { getPlanFeatures } from "./subscription.service";
import { InterviewError } from "@/server/ai/errors";
export async function historyLimit(ownerId: string) { return (await getPlanFeatures(ownerId)).historyVersions ?? 50; }
export async function assertHistoryAccess(ownerId: string, projectId: string, kind: "brief" | "backlog", documentId: string) {
  const limit = (await getPlanFeatures(ownerId)).historyVersions;
  if (limit === null) return;
  const rows = kind === "brief" ? await prisma.brief.findMany({ where: { projectId, project: { ownerId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, select: { id: true } }) : await prisma.backlog.findMany({ where: { projectId, project: { ownerId } }, orderBy: { version: "desc" }, take: limit, select: { id: true } });
  if (!rows.some((row) => row.id === documentId)) throw new InterviewError("FEATURE_UNAVAILABLE", 403, "Le plan Free donne accès aux deux dernières versions. Consulte les offres pour accéder à l’historique complet.");
}
