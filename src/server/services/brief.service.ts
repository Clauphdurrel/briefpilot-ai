import { captureBusinessEvent } from "@/server/observability/analytics";
import { observed } from "@/server/observability/operations";
import "server-only";
import { historyLimit, assertHistoryAccess } from "./history-access.service";
import { lockUsage, reserveUsage } from "./usage.service";
import { runMetered } from "@/server/ai/usage-context";

import { createHash } from "node:crypto";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { runBriefGeneratorAgent, validateBriefSources } from "@/server/agents/brief-generator.agent";
import { InterviewError } from "@/server/ai/errors";
import { renderBriefMarkdown } from "@/server/formatters/brief-markdown";
import { generateBriefRequestSchema, storedBriefSchema, type BriefAgentInput, type GenerateBriefRequest } from "@/server/validators/brief-generator.schema";
import { generatedBriefSchema } from "@/server/validators/brief.schema";
import { interviewTurnSchema } from "@/server/validators/interview-agent.schema";
import { projectIdSchema } from "@/server/validators/project.schema";

type Db = Prisma.TransactionClient;
const ledgerSchema = z.object({
  kind: z.enum(["brief_request", "brief_reuse"]), requestId: z.uuid(), hash: z.string(), sourceRevision: z.string(),
  status: z.enum(["pending", "completed", "failed"]), attempts: z.number().int().min(0).max(3),
  leaseUntil: z.iso.datetime(), briefId: z.string().nullable(),
});
const headerSchema = z.object({ generation: z.object({ version: z.number().int().positive(), draft: z.boolean(), sourceRevision: z.string() }) });
const json = (value: object) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function lock(tx: Db, ownerId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`interview:${ownerId}`}, 0))`;
}
async function owned(db: Db, ownerId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true, name: true, type: true, description: true, status: true } });
  if (!project) throw new InterviewError("PROJECT_NOT_FOUND", 404, "Projet introuvable.");
  return project;
}
async function sourceSnapshot(db: Db, ownerId: string, projectId: string, language: "fr" | "en") {
  const project = await owned(db, ownerId, projectId);
  const rows = (await db.interviewMessage.findMany({
    where: { projectId, role: { in: ["user", "assistant"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200,
  })).reverse();
  const last = [...rows].reverse().find((item) => item.role === "assistant");
  const metadata = last?.metadata && typeof last.metadata === "object" && !Array.isArray(last.metadata) ? last.metadata : null;
  const analysis = interviewTurnSchema.safeParse(metadata?.analysis);
  const missing = analysis.success ? analysis.data.missingInformation : ["Objectifs", "Utilisateurs cibles", "Fonctionnalités prioritaires", "Budget", "Délais"];
  const requiresDraft = !analysis.success || analysis.data.completionScore < 100 || missing.length > 0;
  const sourceRevision = hash({ project: { name: project.name, type: project.type, description: project.description }, language,
    messages: rows.map((item) => ({ id: item.id, role: item.role, content: item.content })), analysis: analysis.success ? analysis.data : null });
  return { project, rows, analysis: analysis.success ? analysis.data : null, sourceRevision,
    readiness: { hasInterview: rows.length > 0, requiresDraft, missingInformation: missing, sourceRevision } };
}

function sourceInput(snapshot: Awaited<ReturnType<typeof sourceSnapshot>>, request: GenerateBriefRequest): { input: BriefAgentInput; truncated: boolean } {
  const sources: BriefAgentInput["sources"] = [{ id: "project:name", text: snapshot.project.name, kind: "project" }];
  if (snapshot.project.description) sources.push({ id: "project:description", text: snapshot.project.description, kind: "project" });
  let characters = sources.reduce((sum, item) => sum + item.text.length, 0);
  const answers = snapshot.rows.filter((item) => item.role === "user");
  let selectedAnswers = 0;
  for (const item of [...answers].reverse()) {
    if (sources.length >= 50 || characters + item.content.length > 32000) break;
    sources.push({ id: `message:${item.id}`, text: item.content, kind: "answer" }); characters += item.content.length; selectedAnswers++;
  }
  const history: BriefAgentInput["history"] = [];
  let historySize = 0;
  for (const item of [...snapshot.rows].reverse()) {
    if (history.length >= 10 || historySize + item.content.length > 10000) break;
    history.push({ role: item.role === "user" ? "user" : "assistant", content: item.content }); historySize += item.content.length;
  }
  return { truncated: selectedAnswers < answers.length, input: {
    project: { name: snapshot.project.name, type: snapshot.project.type, description: snapshot.project.description },
    sources, history: history.reverse(), knownInformation: (snapshot.analysis?.knownInformation ?? []).slice(0, 10).map((item) => item.slice(0, 500)),
    missingInformation: snapshot.readiness.missingInformation.slice(0, 15).map((item) => item.slice(0, 500)),
    language: request.language, draftRequested: snapshot.readiness.requiresDraft || selectedAnswers < answers.length,
  } };
}

function present(row: { id: string; title: string; createdAt: Date; json: Prisma.JsonValue }) {
  const header = headerSchema.safeParse(row.json);
  return { id: row.id, title: row.title, createdAt: row.createdAt.toISOString(),
    version: header.success ? header.data.generation.version : null,
    draft: header.success ? header.data.generation.draft : true,
    sourceRevision: header.success ? header.data.generation.sourceRevision : null };
}

export async function listBriefs(ownerId: string, rawProjectId: string) {
  const projectId = projectIdSchema.parse(rawProjectId);
  const snapshot = await sourceSnapshot(prisma, ownerId, projectId, "fr");
  const rows = await prisma.brief.findMany({ where: { projectId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: await historyLimit(ownerId), select: { id: true, title: true, createdAt: true, json: true } });
  return { briefs: rows.map(present), readiness: snapshot.readiness };
}

// The reader needs only version headers, not the JSON document of every old version.
export async function getBriefReaderContext(ownerId: string, rawProjectId: string) {
  const projectId = projectIdSchema.parse(rawProjectId);
  const snapshot = await sourceSnapshot(prisma, ownerId, projectId, "fr");
  const rows = await prisma.$queryRaw<{ id: string; title: string; createdAt: Date; generation: Prisma.JsonValue }[]>`
    SELECT b."id", b."title", b."createdAt", b."json"->'generation' AS "generation"
    FROM "Brief" b JOIN "Project" p ON p."id" = b."projectId"
    WHERE b."projectId" = ${projectId} AND p."ownerId" = ${ownerId}
    ORDER BY b."createdAt" DESC, b."id" DESC LIMIT ${await historyLimit(ownerId)}
  `;
  return { readiness: snapshot.readiness, briefs: rows.map((row) => present({ ...row, json: { generation: row.generation } })) };
}

export async function getBriefForSource(ownerId: string, rawProjectId: string, rawBriefId: string) {
  const projectId = projectIdSchema.parse(rawProjectId), briefId = projectIdSchema.parse(rawBriefId);
  await owned(prisma, ownerId, projectId);
  const row = await prisma.brief.findFirst({ where: { id: briefId, projectId }, select: { id: true, title: true, createdAt: true, json: true } });
  if (!row) throw new InterviewError("BRIEF_NOT_FOUND", 404, "Cahier des charges introuvable.");
  const parsed = storedBriefSchema.safeParse(row.json);
  if (!parsed.success) throw new InterviewError("BRIEF_LEGACY_FORMAT", 422, "Ce document utilise un ancien format. Génère une nouvelle version.");
  return { id: row.id, title: row.title, createdAt: row.createdAt.toISOString(), ...parsed.data };
}

export async function getBrief(ownerId: string, rawProjectId: string, rawBriefId: string) {
  const row = await getBriefForSource(ownerId, rawProjectId, rawBriefId);
  await assertHistoryAccess(ownerId, rawProjectId, "brief", rawBriefId);
  return row;
}

export async function getLatestBrief(ownerId: string, projectId: string) {
  const list = await listBriefs(ownerId, projectId);
  return list.briefs[0] ? getBrief(ownerId, projectId, list.briefs[0].id) : null;
}

export async function listWorkspaceBriefs(ownerId: string) {
  const rows = await prisma.brief.findMany({ where: { project: { ownerId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    select: { id: true, title: true, createdAt: true, json: true, projectId: true, project: { select: { name: true } } } });
  const limit = await historyLimit(ownerId), counts = new Map<string, number>();
  return rows.filter((row) => { const count = (counts.get(row.projectId) ?? 0) + 1; counts.set(row.projectId, count); return count <= limit; }).map((row) => ({ ...present(row), projectId: row.projectId, projectName: row.project.name }));
}

async function generateBriefCore(ownerId: string, rawProjectId: string, raw: GenerateBriefRequest) {
  const projectId = projectIdSchema.parse(rawProjectId);
  const request = generateBriefRequestSchema.parse(raw);
  const ledgerId = `brief_${hash({ projectId, requestId: request.requestId })}`;
  const payloadHash = hash(request);
  const claim = await prisma.$transaction(async (tx) => {
    await lock(tx, ownerId);
    const snapshot = await sourceSnapshot(tx, ownerId, projectId, request.language);
    const existing = await tx.interviewMessage.findUnique({ where: { id: ledgerId } });
    const previous = existing ? ledgerSchema.parse(existing.metadata) : null;
    if (previous && previous.hash !== payloadHash) throw new InterviewError("IDEMPOTENCY_CONFLICT", 409, "Cette demande a déjà été utilisée avec un autre contenu.");
    if (previous?.status === "completed" && previous.briefId) return { kind: "cached" as const, briefId: previous.briefId };
    if (!snapshot.readiness.hasInterview) throw new InterviewError("NO_INTERVIEW", 422, "Démarre l’interview avant de générer le cahier des charges.");
    const context = sourceInput(snapshot, request);
    if ((snapshot.readiness.requiresDraft || context.truncated) && !request.allowDraft) {
      throw new InterviewError("DRAFT_REQUIRED", 422, `L’interview est incomplète. Continue-la ou choisis un brouillon. À préciser : ${snapshot.readiness.missingInformation.slice(0, 5).join(", ") || "historique à compléter"}.`);
    }
    const latest = await tx.brief.findFirst({ where: { projectId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, json: true } });
    const now = new Date();
    const latestDocument = storedBriefSchema.safeParse(latest?.json);
    if (latest && latestDocument.success && latestDocument.data.generation.sourceRevision === snapshot.sourceRevision) {
      // Replays keep their durable identity; new aliases are bounded independently of AI quota.
      if (!previous) {
        await lockUsage(tx, ownerId);
        const aliases = await tx.interviewMessage.count({ where: {
          role: "system", project: { ownerId }, createdAt: { gte: new Date(now.getTime() - 86400000) },
          metadata: { path: ["kind"], equals: "brief_reuse" },
        } });
        if (aliases >= 100) throw new InterviewError("REUSE_RATE_LIMIT", 429, "Trop de nouvelles demandes de réutilisation. Réutilise la demande précédente ou réessaie plus tard.");
      }
      const reused = { kind: previous?.kind ?? "brief_reuse", requestId: request.requestId, hash: payloadHash, sourceRevision: snapshot.sourceRevision,
        status: "completed", attempts: previous?.attempts ?? 0, leaseUntil: now.toISOString(), briefId: latest.id };
      await tx.interviewMessage.upsert({ where: { id: ledgerId }, create: { id: ledgerId, projectId, role: "system", content: "", metadata: json(reused), createdAt: now }, update: { metadata: json(reused) } });
      return { kind: "cached" as const, briefId: latest.id };
    }
    const recent = await tx.interviewMessage.findMany({ where: { role: "system", project: { ownerId }, createdAt: { gte: new Date(now.getTime() - 86400000) }, metadata: { path: ["kind"], equals: "brief_request" } }, orderBy: { createdAt: "desc" }, take: 31 });
    const attempts = recent.flatMap((row) => { const parsed = ledgerSchema.safeParse(row.metadata); return parsed.success ? [{ ...parsed.data, projectId: row.projectId, createdAt: row.createdAt }] : []; });
    if (attempts.some((item) => item.projectId === projectId && item.status === "pending" && Date.parse(item.leaseUntil) > now.getTime())) throw new InterviewError("BRIEF_BUSY", 409, "Une génération est en cours. Actualise la liste dans quelques instants.");
    if (previous && previous.attempts >= 3) throw new InterviewError("RETRY_LIMIT", 429, "Cette demande a atteint sa limite de tentatives.");
    if (attempts.reduce((sum, item) => sum + item.attempts, 0) >= 10 ||
      attempts.filter((item) => now.getTime() - item.createdAt.getTime() < 60000).reduce((sum, item) => sum + item.attempts, 0) >= 2 ||
      attempts.some((item) => item.projectId === projectId && now.getTime() - item.createdAt.getTime() < 10000)) {
      throw new InterviewError("BRIEF_RATE_LIMIT", 429, "Patiente avant de régénérer (2 tentatives par minute, 10 par jour au maximum).");
    }
    if (await tx.brief.count({ where: { projectId } }) >= 50) throw new InterviewError("VERSION_LIMIT", 422, "Ce projet a atteint sa limite de 50 versions conservées.");
    const metadata: z.infer<typeof ledgerSchema> = { kind: "brief_request", requestId: request.requestId, hash: payloadHash, sourceRevision: snapshot.sourceRevision,
      status: "pending", attempts: (previous?.attempts ?? 0) + 1, leaseUntil: new Date(now.getTime() + 90000).toISOString(), briefId: null };
    await tx.interviewMessage.upsert({ where: { id: ledgerId }, create: { id: ledgerId, projectId, role: "system", content: "", metadata: json(metadata), createdAt: now }, update: { metadata: json(metadata), createdAt: now } });
    const usage = await reserveUsage(ownerId, "AI_BRIEF", `${ledgerId}:${metadata.attempts}`, tx);
    return { kind: "claimed" as const, usage, snapshot, context, metadata };
  });
  if (claim.kind === "cached") return { briefId: claim.briefId, reused: true };

  try {
    const result = await runMetered(claim.usage, () => runBriefGeneratorAgent(claim.context.input));
    const document = generatedBriefSchema.parse(result.document);
    validateBriefSources(document, claim.context.input.sources);
    // Keep source gaps visible even if the model omits them in its output.
    const coreGaps = [
      ...(document.features.length ? [] : ["Fonctionnalités à préciser"]),
      ...(document.businessObjectives.length ? [] : ["Objectifs à préciser"]),
      ...(document.targetAudience.length ? [] : ["Utilisateurs cibles à préciser"]),
      ...(document.projectScope.included.length ? [] : ["Périmètre inclus à préciser"]),
    ];
    const sourceGaps = [...claim.snapshot.readiness.missingInformation, ...coreGaps].map((missing) => ({ category: "interview", description: missing, importance: "high" as const, question: `Peux-tu préciser : ${missing} ?` }));
    document.missingInformation = [...sourceGaps, ...document.missingInformation]
      .filter((item, index, all) => all.findIndex((other) => other.description === item.description) === index).slice(0, 40);
    const hasMissing = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.some(hasMissing);
      if (!value || typeof value !== "object") return false;
      return (value as Record<string, unknown>).status === "missing" || Object.values(value).some(hasMissing);
    };
    const draft = claim.context.truncated || claim.snapshot.readiness.requiresDraft || document.missingInformation.length > 0 || hasMissing(document);
    return await prisma.$transaction(async (tx) => {
      await lock(tx, ownerId);
      const fresh = await sourceSnapshot(tx, ownerId, projectId, request.language);
      const row = await tx.interviewMessage.findUnique({ where: { id: ledgerId } });
      const metadata = ledgerSchema.parse(row?.metadata);
      if (metadata.status !== "pending" || metadata.attempts !== claim.metadata.attempts || Date.parse(metadata.leaseUntil) < Date.now()) throw new InterviewError("STALE_REQUEST", 409, "La génération a expiré. Actualise la liste.");
      if (fresh.sourceRevision !== claim.snapshot.sourceRevision) throw new InterviewError("BRIEF_SOURCE_CHANGED", 409, "L’interview ou le projet a changé pendant la génération. Relance-la avec les nouvelles informations.");
      const version = await tx.brief.count({ where: { projectId } }) + 1;
      const now = new Date();
      const stored = storedBriefSchema.parse({ schemaVersion: "brief.v1", document, generation: {
        version, requestId: request.requestId, sourceRevision: claim.snapshot.sourceRevision, projectName: claim.snapshot.project.name, projectType: claim.snapshot.project.type,
        language: request.language, draft, generatedAt: now.toISOString(), model: result.model,
      } });
      const title = `Cahier des charges — ${stored.generation.projectName}`;
      const saved = await tx.brief.create({ data: { title, projectId, content: renderBriefMarkdown(document, title, draft), json: json(stored) }, select: { id: true } });
      await tx.interviewMessage.update({ where: { id: ledgerId }, data: { metadata: json({ ...metadata, status: "completed", briefId: saved.id }) } });
      if (!draft) await tx.project.updateMany({ where: { id: projectId, ownerId, status: { in: ["DRAFT", "INTERVIEW", "BRIEF_GENERATED"] } }, data: { status: "BRIEF_GENERATED" } });
      return { briefId: saved.id, reused: false };
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await lock(tx, ownerId);
      const row = await tx.interviewMessage.findUnique({ where: { id: ledgerId } });
      const parsed = ledgerSchema.safeParse(row?.metadata);
      if (parsed.success && parsed.data.status === "pending" && parsed.data.attempts === claim.metadata.attempts) await tx.interviewMessage.update({ where: { id: ledgerId }, data: { metadata: json({ ...parsed.data, status: "failed" }) } });
    });
    throw error;
  }
}

export const generateBrief: typeof generateBriefCore = observed("brief", "generate_brief", generateBriefCore, (ownerId, projectId) => ({ userId: ownerId, projectId }), async (result, ownerId) => { if (!result.reused) await captureBusinessEvent(ownerId, "brief_generated", result.briefId); });
