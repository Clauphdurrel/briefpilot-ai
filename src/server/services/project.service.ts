import { prisma } from "@/lib/prisma";
import type { CreateProjectInput } from "@/server/validators/project.schema";

export async function createOwnedProject(ownerId: string, input: CreateProjectInput) {
  return prisma.project.create({
    data: { ...input, description: input.description || null, ownerId },
    select: { id: true },
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
      _count: { select: { interviews: true, briefs: true } },
    },
  });
}
