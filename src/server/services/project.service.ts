import { captureBusinessEvent } from "@/server/observability/analytics";
import { observed } from "@/server/observability/operations";
import "server-only";
import { assertProjectCapacity, lockUsage } from "./usage.service";
import { createProjectSchema, projectIdSchema } from "@/server/validators/project.schema";
import { InterviewError } from "@/server/ai/errors";
import { prisma } from "@/lib/prisma";
import type { CreateProjectInput } from "@/server/validators/project.schema";

async function createOwnedProjectCore(ownerId: string, input: CreateProjectInput) {
  const validated = createProjectSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await assertProjectCapacity(tx, ownerId);
    return tx.project.create({
    data: { ...validated, description: validated.description || null, ownerId },
    select: { id: true },
    });
  });
}

export async function listOwnedProjects(ownerId: string) {
  return prisma.project.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true, type: true, status: true, description: true },
  });
}

export async function getOwnedProject(ownerId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, ownerId },
    select: {
      id: true, name: true, type: true, status: true, description: true,
      _count: { select: { interviews: { where: { role: { in: ["user", "assistant"] } } }, briefs: true } },
    },
  });
}

export async function setProjectArchived(ownerId: string, rawProjectId: string, archived: boolean) {
  const projectId = projectIdSchema.parse(rawProjectId);
  if (typeof archived !== "boolean") throw new InterviewError("INVALID_INPUT", 400, "Statut invalide.");
  return prisma.$transaction(async (tx) => {
    await lockUsage(tx, ownerId);
    const project = await tx.project.findFirst({ where: { id: projectId, ownerId } });
    if (!project) throw new InterviewError("PROJECT_NOT_FOUND", 404, "Projet introuvable.");
    if (!archived && project.status === "ARCHIVED") await assertProjectCapacity(tx, ownerId);
    return tx.project.update({ where: { id: projectId }, data: { status: archived ? "ARCHIVED" : project.status === "ARCHIVED" ? "DRAFT" : project.status }, select: { id: true, status: true } });
  });
}

export const createOwnedProject: typeof createOwnedProjectCore = observed("project", "create_project", createOwnedProjectCore, (ownerId) => ({ userId: ownerId }), async (result, ownerId) => { await captureBusinessEvent(ownerId, "project_created", result.id); });
