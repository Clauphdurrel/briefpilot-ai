import "server-only";
import { reserveUsage } from "./usage.service";
import { runMetered } from "@/server/ai/usage-context";

import { createHash } from "node:crypto";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { runInterviewClientAgent } from "@/server/agents/interview-client.agent";
import { InterviewError } from "@/server/ai/errors";
import {
  interviewTurnSchema, sendInterviewMessageSchema, startInterviewSchema,
  type InterviewState, type InterviewTurn, type SendInterviewMessageInput, type StartInterviewInput,
} from "@/server/validators/interview-agent.schema";
import { projectIdSchema } from "@/server/validators/project.schema";

type Db = Prisma.TransactionClient;
const requestMetadataSchema = z.object({
  kind: z.literal("interview_request"), requestId: z.uuid(), hash: z.string(),
  status: z.enum(["pending", "completed", "failed"]), attempts: z.number().int().min(1).max(3),
  leaseUntil: z.iso.datetime(),
});
type RequestMetadata = z.infer<typeof requestMetadataSchema>;

function json(value: object): Prisma.InputJsonObject {
  // Remove optional undefined fields before writing already-validated data to JSONB.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

async function lockOwner(tx: Db, ownerId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`interview:${ownerId}`}, 0))`;
}

async function ownedProject(db: Db, ownerId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId }, select: { id: true, name: true, type: true, description: true },
  });
  if (!project) throw new InterviewError("PROJECT_NOT_FOUND", 404, "Projet introuvable.");
  return project;
}

async function history(db: Db, projectId: string) {
  const rows = await db.interviewMessage.findMany({
    where: { projectId, role: { in: ["user", "assistant"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200,
  });
  return rows.reverse();
}
type History = Awaited<ReturnType<typeof history>>;

function lastAnalysis(messages: History): InterviewTurn | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant" || !message.metadata || typeof message.metadata !== "object" || Array.isArray(message.metadata)) continue;
    const parsed = interviewTurnSchema.safeParse(message.metadata.analysis);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function state(messages: History): InterviewState {
  const analysis = lastAnalysis(messages);
  return {
    messages: messages.map((item) => ({
      id: item.id, role: item.role === "user" ? "user" : "assistant",
      content: item.content, createdAt: item.createdAt.toISOString(),
    })),
    analysis,
    completionScore: analysis?.completionScore ?? null,
    missingInformation: analysis?.missingInformation ?? [],
  };
}

export async function getInterview(ownerId: string, rawProjectId: string): Promise<InterviewState> {
  const projectId = projectIdSchema.parse(rawProjectId);
  await ownedProject(prisma, ownerId, projectId);
  return state(await history(prisma, projectId));
}

function boundedHistory(messages: History, content?: string) {
  const all = messages.map((item) => ({ role: item.role === "user" ? "user" as const : "assistant" as const, content: item.content }));
  if (content) all.push({ role: "user", content });
  const selected: typeof all = [];
  let characters = 0;
  for (const item of all.reverse()) {
    if (selected.length >= 30 || characters + item.content.length > 32000) break;
    selected.push(item); characters += item.content.length;
  }
  return selected.reverse();
}

export async function advanceInterview(
  ownerId: string, rawProjectId: string,
  rawInput: StartInterviewInput | SendInterviewMessageInput,
  mode: "start" | "message",
): Promise<InterviewState> {
  const projectId = projectIdSchema.parse(rawProjectId);
  const messageInput = mode === "message" ? sendInterviewMessageSchema.parse(rawInput) : null;
  const input = messageInput ?? startInterviewSchema.parse(rawInput);
  const content = messageInput?.content;
  const hash = createHash("sha256").update(JSON.stringify({ mode, ...input })).digest("hex");
  const ledgerId = `interview_${createHash("sha256").update(`${projectId}:${input.requestId}`).digest("hex")}`;

  const claim = await prisma.$transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const project = await ownedProject(tx, ownerId, projectId);
    const messages = await history(tx, projectId);
    const existing = await tx.interviewMessage.findUnique({ where: { id: ledgerId } });
    const previous = existing ? requestMetadataSchema.parse(existing.metadata) : null;
    if (previous && previous.hash !== hash) throw new InterviewError("IDEMPOTENCY_CONFLICT", 409, "Cette demande a déjà été utilisée avec un autre contenu.");
    if (previous?.status === "completed") return { kind: "cached" as const, snapshot: state(messages) };
    if (mode === "start" && messages.some((item) => item.role === "assistant")) return { kind: "cached" as const, snapshot: state(messages) };

    const now = new Date();
    const recent = await tx.interviewMessage.findMany({
      where: { role: "system", project: { ownerId }, createdAt: { gte: new Date(now.getTime() - 86400000) }, metadata: { path: ["kind"], equals: "interview_request" } },
      orderBy: { createdAt: "desc" }, take: 121,
    });
    const requests = recent.flatMap((item) => {
      const parsed = requestMetadataSchema.safeParse(item.metadata);
      return parsed.success ? [{ ...parsed.data, createdAt: item.createdAt, projectId: item.projectId }] : [];
    });
    if (requests.some((item) => item.projectId === projectId && item.status === "pending" && Date.parse(item.leaseUntil) > now.getTime())) {
      throw new InterviewError("INTERVIEW_BUSY", 409, "Une réponse est en cours. Patiente puis actualise l’historique.");
    }
    if (previous && previous.attempts >= 3) throw new InterviewError("RETRY_LIMIT", 429, "Cette demande a atteint sa limite de tentatives. Actualise l’historique avant de réessayer.");
    const dailyAttempts = requests.reduce((sum, item) => sum + item.attempts, 0);
    const minuteAttempts = requests.filter((item) => now.getTime() - item.createdAt.getTime() < 60000).reduce((sum, item) => sum + item.attempts, 0);
    if (dailyAttempts >= 40 || minuteAttempts >= 5 || requests.some((item) => item.projectId === projectId && now.getTime() - item.createdAt.getTime() < 3000)) {
      throw new InterviewError("RATE_LIMIT", 429, "Limite d’appels atteinte. Patiente avant de réessayer (40 tentatives par jour au maximum).");
    }
    if (messages.length >= (content ? 199 : 200)) throw new InterviewError("HISTORY_LIMIT", 422, "Cette interview a atteint sa limite de messages.");
    const last = messages.at(-1);
    if (mode === "message" && (!last || last.role !== "assistant" || messageInput?.expectedLastMessageId !== last.id)) {
      throw new InterviewError("STALE_INTERVIEW", 409, "L’interview a changé. Actualise l’historique avant d’envoyer ta réponse.");
    }
    const metadata: RequestMetadata = {
      kind: "interview_request", requestId: input.requestId, hash, status: "pending",
      attempts: (previous?.attempts ?? 0) + 1, leaseUntil: new Date(now.getTime() + 90000).toISOString(),
    };
    await tx.interviewMessage.upsert({
      where: { id: ledgerId },
      create: { id: ledgerId, projectId, role: "system", content: "", metadata: json(metadata), createdAt: now },
      update: { metadata: json(metadata), createdAt: now },
    });
    const usage = await reserveUsage(ownerId, "AI_INTERVIEW", `${ledgerId}:${metadata.attempts}`, tx);
    return { kind: "claimed" as const, usage, project, messages, metadata };
  });
  if (claim.kind === "cached") return claim.snapshot;

  try {
    const previousAnalysis = lastAnalysis(claim.messages);
    const { analysis, model } = await runMetered(claim.usage, () => runInterviewClientAgent({
      project: { name: claim.project.name, type: claim.project.type, description: claim.project.description },
      history: boundedHistory(claim.messages, content), knownInformation: previousAnalysis?.knownInformation ?? [],
      previousAnalysis, language: input.language,
    }));
    return await prisma.$transaction(async (tx) => {
      await lockOwner(tx, ownerId);
      await ownedProject(tx, ownerId, projectId);
      const current = await tx.interviewMessage.findUnique({ where: { id: ledgerId } });
      const metadata = requestMetadataSchema.parse(current?.metadata);
      if (metadata.status !== "pending" || metadata.attempts !== claim.metadata.attempts || Date.parse(metadata.leaseUntil) < Date.now()) {
        throw new InterviewError("STALE_REQUEST", 409, "Cette demande a expiré. Actualise l’historique.");
      }
      const now = new Date();
      if (content) await tx.interviewMessage.create({ data: {
        projectId, role: "user", content, createdAt: now,
        metadata: json({ requestId: input.requestId, questionId: previousAnalysis?.nextQuestion?.id ?? null }),
      } });
      await tx.interviewMessage.create({ data: {
        projectId, role: "assistant", content: analysis.message, createdAt: new Date(now.getTime() + 1),
        metadata: json({ kind: "interview_analysis", analysis, model, requestId: input.requestId }),
      } });
      await tx.interviewMessage.update({ where: { id: ledgerId }, data: { metadata: json({ ...metadata, status: "completed" }) } });
      await tx.project.updateMany({ where: { id: projectId, ownerId, status: "DRAFT" }, data: { status: "INTERVIEW" } });
      return state(await history(tx, projectId));
    });
  } catch (error) {
    // Keep a durable failure marker without storing SDK errors or secrets.
    await prisma.$transaction(async (tx) => {
      await lockOwner(tx, ownerId);
      const current = await tx.interviewMessage.findUnique({ where: { id: ledgerId } });
      const parsed = requestMetadataSchema.safeParse(current?.metadata);
      if (parsed.success && parsed.data.status === "pending" && parsed.data.attempts === claim.metadata.attempts) {
        await tx.interviewMessage.update({ where: { id: ledgerId }, data: { metadata: json({ ...parsed.data, status: "failed" }) } });
      }
    });
    throw error;
  }
}
