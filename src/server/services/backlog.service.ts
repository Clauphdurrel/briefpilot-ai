import { captureBusinessEvent } from "@/server/observability/analytics";
import { observed } from "@/server/observability/operations";
import "server-only";
import { historyLimit, assertHistoryAccess } from "./history-access.service";
import { lockUsage, reserveUsage } from "./usage.service";
import { runMetered } from "@/server/ai/usage-context";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBacklogContext, runBacklogGeneratorAgent } from "@/server/agents/backlog-generator.agent";
import { InterviewError } from "@/server/ai/errors";
import { containsCredential, renderCodexPrompt } from "@/server/formatters/codex-task";
import { backlogSchema, generateBacklogRequestSchema, storedBacklogSchema, validateBacklog, type BacklogAgentInput } from "@/server/validators/backlog.schema";
import { storedBriefSchema } from "@/server/validators/brief-generator.schema";
import { projectIdSchema } from "@/server/validators/project.schema";

type Db = Prisma.TransactionClient;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const asJson = (value: object) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
async function lock(db: Db, ownerId: string) {
  await db.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`interview:${ownerId}`}, 0))`;
}
async function owned(db: Db, ownerId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true, name: true, type: true, description: true } });
  if (!project) throw new InterviewError("PROJECT_NOT_FOUND", 404, "Projet introuvable.");
  return project;
}
async function snapshot(db: Db, ownerId: string, projectId: string, briefId: string, language: "fr" | "en") {
  const project = await owned(db, ownerId, projectId);
  const row = await db.brief.findFirst({ where: { id: briefId, projectId }, select: { json: true } });
  if (!row) throw new InterviewError("BRIEF_NOT_FOUND", 404, "Cahier des charges introuvable.");
  const parsed = storedBriefSchema.safeParse(row.json);
  if (!parsed.success) throw new InterviewError("BRIEF_LEGACY_FORMAT", 422, "Génère un cahier des charges au format actuel avant de créer son backlog.");
  const source = parsed.data;
  const requiresDraft = source.generation.draft || source.document.missingInformation.length > 0 || source.document.features.some((feature) => ["assumed", "missing"].includes(feature.status));
  const input: BacklogAgentInput = {
    project: { name: source.generation.projectName, type: source.generation.projectType, description: project.description },
    brief: source.document, language,
    confirmedTechnicalInformation: source.document.technicalConstraints.filter((item) => item.status === "confirmed").map((item) => item.text),
    constraints: [...source.document.technicalConstraints, ...source.document.securityRequirements].filter((item) => item.status === "confirmed").map((item) => item.text).slice(0, 40),
  };
  // Validate bounds and sensitive data before reserving an actual provider attempt.
  buildBacklogContext(input);
  return { source, input, requiresDraft, revision: digest({ project, source, language }) };
}
const summarySelect = { id: true, version: true, status: true, sourceBriefId: true, createdAt: true } as const;
export async function getProjectBacklogs(ownerId: string, rawProjectId: string) {
  const projectId = projectIdSchema.parse(rawProjectId);
  await owned(prisma, ownerId, projectId);
  const rows = await prisma.backlog.findMany({ where: { projectId }, orderBy: { version: "desc" }, take: await historyLimit(ownerId), select: summarySelect });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
export async function getBacklogById(ownerId: string, rawProjectId: string, rawBacklogId: string) {
  const projectId = projectIdSchema.parse(rawProjectId), backlogId = projectIdSchema.parse(rawBacklogId);
  await owned(prisma, ownerId, projectId);
  const row = await prisma.backlog.findFirst({ where: { id: backlogId, projectId } });
  if (!row) throw new InterviewError("BACKLOG_NOT_FOUND", 404, "Backlog introuvable.");
  await assertHistoryAccess(ownerId, projectId, "backlog", backlogId);
  const parsed = storedBacklogSchema.safeParse(row.data);
  if (!parsed.success) throw new InterviewError("BACKLOG_INVALID_STORED", 422, "Ce backlog ne peut pas être affiché. Génère une nouvelle version.");
  return { id: row.id, version: row.version, status: row.status, sourceBriefId: row.sourceBriefId, createdAt: row.createdAt.toISOString(), ...parsed.data };
}
export async function getLatestBacklog(ownerId: string, projectId: string) {
  const versions = await getProjectBacklogs(ownerId, projectId);
  return versions[0] ? getBacklogById(ownerId, projectId, versions[0].id) : null;
}

async function generateBacklogCore(ownerId: string, rawProjectId: string, raw: unknown) {
  const projectId = projectIdSchema.parse(rawProjectId), request = generateBacklogRequestSchema.parse(raw);
  const key = { projectId_requestId: { projectId, requestId: request.requestId } };
  const payloadHash = digest(request);
  const claim = await prisma.$transaction(async (tx) => {
    await lock(tx, ownerId);
    const context = await snapshot(tx, ownerId, projectId, request.sourceBriefId, request.language);
    await assertHistoryAccess(ownerId, projectId, "brief", request.sourceBriefId, tx);
    const previous = await tx.backlogGeneration.findUnique({ where: key });
    if (previous && previous.payloadHash !== payloadHash) throw new InterviewError("IDEMPOTENCY_CONFLICT", 409, "Cette demande a déjà été utilisée avec un autre contenu.");
    if (previous?.state === "completed" && previous.backlogId) return { kind: "cached" as const, backlogId: previous.backlogId };
    if (context.requiresDraft && !request.allowDraft) throw new InterviewError("DRAFT_REQUIRED", 422, "Le cahier des charges est incomplet. Accepte explicitement un backlog brouillon ou complète le document.");
    const now = new Date();
    if (!request.regenerate) {
      const existing = await tx.backlog.findFirst({ where: { projectId, sourceBriefId: request.sourceBriefId, sourceRevision: context.revision }, orderBy: { version: "desc" }, select: { id: true } });
      if (existing) {
        // Same-key retries remain free; distinct cache aliases cannot grow storage without bounds.
        if (!previous) {
          await lockUsage(tx, ownerId);
          const aliases = await tx.backlogGeneration.count({ where: {
            project: { ownerId }, createdAt: { gte: new Date(now.getTime() - 86400000) }, chargedAt: { isEmpty: true },
          } });
          if (aliases >= 100) throw new InterviewError("REUSE_RATE_LIMIT", 429, "Trop de nouvelles demandes de réutilisation. Réutilise la demande précédente ou réessaie plus tard.");
        }
        await tx.backlogGeneration.upsert({ where: key,
          create: { projectId, requestId: request.requestId, payloadHash, sourceRevision: context.revision, state: "completed", backlogId: existing.id },
          update: { state: "completed", backlogId: existing.id, sourceRevision: context.revision, leaseUntil: null } });
        return { kind: "cached" as const, backlogId: existing.id };
      }
    }
    const recent = await tx.backlogGeneration.findMany({ where: { project: { ownerId }, lastAttemptAt: { gte: new Date(now.getTime() - 86400000) } }, select: { projectId: true, state: true, leaseUntil: true, chargedAt: true }, take: 31 });
    if (recent.some((item) => item.projectId === projectId && item.state === "pending" && item.leaseUntil && item.leaseUntil > now)) throw new InterviewError("BACKLOG_BUSY", 409, "Une génération est en cours pour ce projet. Patiente puis actualise.");
    if (previous && previous.chargedAt.length >= 3) throw new InterviewError("RETRY_LIMIT", 429, "Cette demande a atteint sa limite de trois tentatives.");
    const charges = recent.flatMap((item) => item.chargedAt.map((at) => ({ at, projectId: item.projectId })));
    if (charges.filter(({ at }) => now.getTime() - at.getTime() < 86400000).length >= 10 || charges.filter(({ at }) => now.getTime() - at.getTime() < 60000).length >= 2 || charges.some(({ at, projectId: id }) => id === projectId && now.getTime() - at.getTime() < 10000)) throw new InterviewError("BACKLOG_RATE_LIMIT", 429, "Patiente avant de régénérer (2 tentatives par minute, 10 par jour).");
    if (await tx.backlog.count({ where: { projectId } }) >= 50) throw new InterviewError("VERSION_LIMIT", 422, "Ce projet a atteint sa limite de 50 versions.");
    const chargedAt = [...(previous?.chargedAt ?? []), now];
    const reservation = { sourceRevision: context.revision, state: "pending", chargedAt, lastAttemptAt: now, leaseUntil: new Date(now.getTime() + 90000), backlogId: null };
    const ledger = await tx.backlogGeneration.upsert({ where: key, create: { projectId, requestId: request.requestId, payloadHash, ...reservation }, update: reservation });
    const usage = await reserveUsage(ownerId, "AI_BACKLOG", `${ledger.id}:${chargedAt.length}`, tx);
    return { kind: "claimed" as const, usage, context, ledgerId: ledger.id, attempt: chargedAt.length };
  });
  if (claim.kind === "cached") return { backlogId: claim.backlogId, reused: true };
  try {
    const result = await runMetered(claim.usage, () => runBacklogGeneratorAgent(claim.context.input));
    const document = backlogSchema.parse(result.document);
    try { validateBacklog(document, claim.context.source.document); }
    catch { throw new InterviewError("BACKLOG_INVALID_GRAPH", 502, "Le backlog généré contient des références ou priorités incohérentes."); }
    document.summary.projectName = claim.context.input.project.name;
    document.summary.projectType = claim.context.input.project.type;
    const sourceMissing = claim.context.source.document.missingInformation.map((item) => item.description);
    document.summary.missingInformation = [...new Set([...sourceMissing, ...document.summary.missingInformation])].slice(0, 40);
    const sourceAssumptions = [...claim.context.source.document.assumptions, ...claim.context.source.document.projectScope.assumptions].map((item) => item.text);
    document.summary.technicalAssumptions = [...new Set([...sourceAssumptions, ...document.summary.technicalAssumptions])].slice(0, 30);
    document.tasks = document.tasks.map((task) => ({ ...task, codexPrompt: renderCodexPrompt(document, task) }));
    // Revalidate assembled prompts and reject credential-like content before persistence.
    backlogSchema.parse(document);
    if (containsCredential(document)) throw new InterviewError("BACKLOG_SENSITIVE_OUTPUT", 502, "Le résultat contient une donnée sensible et ne peut pas être enregistré.");
    const draft = claim.context.requiresDraft || document.summary.missingInformation.length > 0 || document.summary.technicalAssumptions.length > 0 || [...document.epics, ...document.stories, ...document.tasks].some((node) => node.basis === "assumed");
    return await prisma.$transaction(async (tx) => {
      await lock(tx, ownerId);
      const fresh = await snapshot(tx, ownerId, projectId, request.sourceBriefId, request.language);
      const ledger = await tx.backlogGeneration.findUnique({ where: key });
      if (!ledger || ledger.state !== "pending" || ledger.chargedAt.length !== claim.attempt || !ledger.leaseUntil || ledger.leaseUntil.getTime() <= Date.now()) throw new InterviewError("STALE_REQUEST", 409, "La génération a expiré. Relance la demande.");
      if (fresh.revision !== claim.context.revision) throw new InterviewError("BACKLOG_SOURCE_CHANGED", 409, "Le projet ou le brief source a changé pendant la génération. Relance-la.");
      const last = await tx.backlog.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } });
      const stored = storedBacklogSchema.parse({ schemaVersion: "backlog.v1", document, generation: { model: result.model, language: request.language, generatedAt: new Date().toISOString(), projectName: claim.context.input.project.name, sourceBriefVersion: claim.context.source.generation.version } });
      const saved = await tx.backlog.create({ data: { projectId, sourceBriefId: request.sourceBriefId, version: (last?.version ?? 0) + 1, status: draft ? "DRAFT" : "READY", sourceRevision: claim.context.revision, data: asJson(stored) }, select: { id: true } });
      await tx.backlogGeneration.update({ where: { id: claim.ledgerId }, data: { state: "completed", backlogId: saved.id, leaseUntil: null } });
      return { backlogId: saved.id, reused: false };
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await lock(tx, ownerId);
      const ledger = await tx.backlogGeneration.findUnique({ where: key });
      if (ledger?.state === "pending" && ledger.chargedAt.length === claim.attempt) await tx.backlogGeneration.update({ where: { id: ledger.id }, data: { state: "failed", leaseUntil: null } });
    });
    throw error;
  }
}

export const generateBacklog: typeof generateBacklogCore = observed("backlog", "generate_backlog", generateBacklogCore, (ownerId, projectId) => ({ userId: ownerId, projectId }), async (result, ownerId) => { if (!result.reused) await captureBusinessEvent(ownerId, "backlog_generated", result.backlogId); });
