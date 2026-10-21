import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runBacklogGeneratorAgent } from "@/server/agents/backlog-generator.agent";
import { backlogFixture, backlogInput } from "@/server/agents/__tests__/backlog-fixtures";
import { InterviewError } from "@/server/ai/errors";
import { generateBacklog, getBacklogById, getProjectBacklogs, getLatestBacklog } from "../backlog.service";

const mocks = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.client }));
vi.mock("@/server/agents/backlog-generator.agent", async (original) => ({ ...await original<typeof import("@/server/agents/backlog-generator.agent")>(), runBacklogGeneratorAgent: vi.fn() }));
type Ledger = { id: string; projectId: string; requestId: string; payloadHash: string; sourceRevision: string; state: string; chargedAt: Date[]; leaseUntil: Date | null; backlogId: string | null; lastAttemptAt: Date | null };
type Row = { id: string; projectId: string; sourceBriefId: string; version: number; status: "DRAFT" | "READY"; data: object; sourceRevision: string; createdAt: Date };
let ledgers: Ledger[], rows: Row[], source: object;
let project: { id: string; name: string; type: string; description: string };
let sequence: Promise<unknown>;
function database() {
  const tx = {
    $queryRaw: vi.fn(async () => [{ locked: 1 }]),
    project: { findFirst: vi.fn(async ({ where }: { where: { id: string; ownerId: string } }) => where.id === project.id && where.ownerId === "owner" ? project : null) },
    brief: { findFirst: vi.fn(async ({ where }: { where: { id: string; projectId: string } }) => where.id === "brief-1" && where.projectId === project.id ? { json: source } : null) },
    backlogGeneration: {
      findUnique: vi.fn(async ({ where }: { where: { projectId_requestId: { projectId: string; requestId: string } } }) => ledgers.find((row) => row.projectId === where.projectId_requestId.projectId && row.requestId === where.projectId_requestId.requestId) ?? null),
      findMany: vi.fn(async () => ledgers.filter((row) => row.lastAttemptAt && row.lastAttemptAt.getTime() >= Date.now() - 86400000)),
      upsert: vi.fn(async ({ where, create, update }: { where: { projectId_requestId: { requestId: string } }; create: Partial<Ledger>; update: Partial<Ledger> }) => {
        const row = ledgers.find((item) => item.requestId === where.projectId_requestId.requestId);
        if (row) { Object.assign(row, update); return row; }
        const saved = { chargedAt: [], lastAttemptAt: null, leaseUntil: null, backlogId: null, ...create, id: randomUUID() } as Ledger;
        ledgers.push(saved); return saved;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Ledger> }) => { const row = ledgers.find((item) => item.id === where.id)!; Object.assign(row, data); return row; }),
    },
    backlog: {
      findMany: vi.fn(async () => [...rows].reverse()),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; projectId: string; sourceRevision?: string } }) => [...rows].reverse().find((row) => row.projectId === where.projectId && (!where.id || row.id === where.id) && (!where.sourceRevision || row.sourceRevision === where.sourceRevision)) ?? null),
      count: vi.fn(async () => rows.length),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => { const row = { ...data, id: randomUUID(), createdAt: new Date() }; rows.push(row); return { id: row.id }; }),
    },
  };
  return { ...tx, $transaction: vi.fn(<T>(callback: (db: typeof tx) => Promise<T>) => { const result = sequence.then(() => callback(tx)); sequence = result.catch(() => undefined); return result; }) };
}
function request(requestId = randomUUID(), regenerate = false, allowDraft = true) { return { requestId, sourceBriefId: "brief-1", regenerate, allowDraft, language: "fr" }; }
function generate(input = request()) { return generateBacklog("owner", "project-1", input); }
function tick(ms = 61000) { vi.setSystemTime(Date.now() + ms); }
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  sequence = Promise.resolve(); ledgers = []; rows = [];
  project = { id: "project-1", name: "Restaurant", type: "WEBSITE", description: "Réservations" };
  source = { schemaVersion: "brief.v1", document: backlogInput().brief, generation: { version: 1, requestId: randomUUID(), sourceRevision: "a".repeat(64), projectName: "Restaurant", projectType: "WEBSITE", language: "fr", draft: true, generatedAt: new Date().toISOString(), model: "test-model" } };
  Object.assign(mocks.client, database());
  vi.mocked(runBacklogGeneratorAgent).mockResolvedValue({ document: backlogFixture(), model: "test-model" });
});
afterEach(() => vi.useRealTimers());
it.each([["intruder", "project-1"], ["owner", "unknown"]])("protects every operation for %s/%s", async (ownerId, projectId) => {
  await expect(generateBacklog(ownerId, projectId, request())).rejects.toMatchObject({ status: 404 });
  await expect(getProjectBacklogs(ownerId, projectId)).rejects.toMatchObject({ status: 404 });
  await expect(getBacklogById(ownerId, projectId, "any")).rejects.toMatchObject({ status: 404 });
  expect(runBacklogGeneratorAgent).not.toHaveBeenCalled();
});
it("requires a valid owned brief and explicit draft consent before charging", async () => {
  await expect(generate(request(undefined, false, false))).rejects.toMatchObject({ code: "DRAFT_REQUIRED" });
  await expect(generateBacklog("owner", "project-1", { ...request(), sourceBriefId: "foreign" })).rejects.toMatchObject({ status: 404 });
  source = {};
  await expect(generate()).rejects.toMatchObject({ code: "BRIEF_LEGACY_FORMAT" });
  expect(ledgers).toHaveLength(0); expect(runBacklogGeneratorAgent).not.toHaveBeenCalled();
});
it("persists a sourced draft with canonical JSON and safe complete prompts", async () => {
  const result = await generate(), saved = await getBacklogById("owner", project.id, result.backlogId);
  expect(saved.version).toBe(1); expect(saved.status).toBe("DRAFT"); expect(saved.sourceBriefId).toBe("brief-1");
  expect(saved.document.summary.projectName).toBe("Restaurant");
  expect(saved.document.tasks[0].codexPrompt).toContain("AGENTS.md");
  expect(saved.document.summary.missingInformation).toContain("Budget");
  expect((await getLatestBacklog("owner", project.id))?.id).toBe(result.backlogId);
});
it("replays requests and reuses an unchanged source without paid calls", async () => {
  const input = request(), first = await generate(input);
  expect((await generate(input)).backlogId).toBe(first.backlogId);
  expect((await generate()).backlogId).toBe(first.backlogId);
  expect(runBacklogGeneratorAgent).toHaveBeenCalledOnce(); expect(rows).toHaveLength(1);
  expect(ledgers[1].chargedAt).toHaveLength(0);
});
it("allows controlled regeneration and preserves older versions unchanged", async () => {
  const first = await generate(), original = JSON.stringify(rows[0]); tick();
  const second = await generate(request(undefined, true));
  expect(second.backlogId).not.toBe(first.backlogId); expect(rows[1].version).toBe(2);
  expect(JSON.stringify(rows[0])).toBe(original); expect(await getProjectBacklogs("owner", project.id)).toHaveLength(2);
});
it("rejects same-key payload changes", async () => {
  const input = request(); await generate(input);
  await expect(generate({ ...input, regenerate: true })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
});
it("serializes concurrent claims while keeping the AI call outside the transaction", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof runBacklogGeneratorAgent>>) => void;
  vi.mocked(runBacklogGeneratorAgent).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const first = generate(); while (!resolve) await Promise.resolve();
  await expect(generate()).rejects.toMatchObject({ code: "BACKLOG_BUSY" });
  resolve({ document: backlogFixture(), model: "test-model" }); await first;
  expect(rows).toHaveLength(1); expect(runBacklogGeneratorAgent).toHaveBeenCalledOnce();
});
it("never saves results if project data changed during the provider call", async () => {
  vi.mocked(runBacklogGeneratorAgent).mockImplementationOnce(async () => { project.description += " Nouveau périmètre"; return { document: backlogFixture(), model: "test-model" }; });
  await expect(generate()).rejects.toMatchObject({ code: "BACKLOG_SOURCE_CHANGED" });
  expect(rows).toHaveLength(0); expect(ledgers[0].state).toBe("failed");
});
it("retains paid attempts when a failed request later reuses a cached result", async () => {
  const input = request();
  for (let i = 0; i < 3; i++) {
    vi.mocked(runBacklogGeneratorAgent).mockRejectedValueOnce(new InterviewError("BACKLOG_REFUSAL", 422, "Refus"));
    await expect(generate(input)).rejects.toMatchObject({ code: "BACKLOG_REFUSAL" }); tick();
  }
  const chargedAt = [...ledgers[0].chargedAt]; await generate(); await generate(input);
  expect(ledgers[0].chargedAt).toEqual(chargedAt); expect(ledgers[0].state).toBe("completed");
});
it("enforces daily quota using actual attempts including failures", async () => {
  for (let i = 0; i < 10; i++) {
    vi.mocked(runBacklogGeneratorAgent).mockRejectedValueOnce(new InterviewError("BACKLOG_REFUSAL", 422, "Refus"));
    await expect(generate()).rejects.toMatchObject({ code: "BACKLOG_REFUSAL" }); tick();
  }
  await expect(generate()).rejects.toMatchObject({ code: "BACKLOG_RATE_LIMIT" });
  expect(runBacklogGeneratorAgent).toHaveBeenCalledTimes(10);
});
it("revalidates the graph and rejects credential-like output before persistence", async () => {
  const invalid = backlogFixture(); invalid.tasks[0].dependencies = ["T-002"];
  vi.mocked(runBacklogGeneratorAgent).mockResolvedValueOnce({ document: invalid, model: "test-model" });
  await expect(generate()).rejects.toMatchObject({ code: "BACKLOG_INVALID_GRAPH" }); tick();
  const sensitive = backlogFixture(); sensitive.summary.objective = "api_key=abcdefghijklmnop";
  vi.mocked(runBacklogGeneratorAgent).mockResolvedValueOnce({ document: sensitive, model: "test-model" });
  await expect(generate()).rejects.toMatchObject({ code: "BACKLOG_SENSITIVE_OUTPUT" }); expect(rows).toHaveLength(0);
});
it("does not expose backlog identifiers from another project", async () => {
  await expect(getBacklogById("owner", project.id, "foreign-id")).rejects.toMatchObject({ code: "BACKLOG_NOT_FOUND" });
});
