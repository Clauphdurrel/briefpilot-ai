import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { runBriefGeneratorAgent } from "@/server/agents/brief-generator.agent";
import { documentFixture } from "@/server/agents/__tests__/brief-fixtures";
import { turn } from "@/server/agents/__tests__/fixtures";
import { InterviewError } from "@/server/ai/errors";
import { generateBrief, getBrief, getBriefReaderContext, getLatestBrief, listBriefs } from "../brief.service";

const mocks = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.client }));
vi.mock("@/server/agents/brief-generator.agent", async (original) => ({ ...await original<typeof import("@/server/agents/brief-generator.agent")>(), runBriefGeneratorAgent: vi.fn() }));

type Message = { id: string; projectId: string; role: string; content: string; metadata: object | null; createdAt: Date };
type BriefRow = { id: string; projectId: string; title: string; content: string; json: object | null; createdAt: Date };
let messages: Message[], documents: BriefRow[];
let project: { id: string; ownerId: string; name: string; type: string; description: string; status: string };
let sequence: Promise<unknown>;

function database() {
  const tx = {
    $queryRaw: vi.fn(async () => [{ locked: 1 }]),
    project: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; ownerId: string } }) => where.id === project.id && where.ownerId === project.ownerId ? project : null),
      updateMany: vi.fn(async () => { if (["DRAFT", "INTERVIEW", "BRIEF_GENERATED"].includes(project.status)) project.status = "BRIEF_GENERATED"; return { count: 1 }; }),
    },
    interviewMessage: {
      count: vi.fn(async () => messages.filter((row) => (row.metadata as { kind?: string })?.kind === "brief_reuse" && row.createdAt.getTime() >= Date.now() - 86400000).length),
      findMany: vi.fn(async ({ where }: { where: { role: string | { in: string[] }; metadata?: { equals: string } } }) =>
        [...messages].filter((row) => typeof where.role === "string" ? row.role === where.role && (!where.metadata || (row.metadata as { kind?: string })?.kind === where.metadata.equals) : where.role.in.includes(row.role)).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime())),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => messages.find((item) => item.id === where.id) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { id: string }; create: Message; update: Partial<Message> }) => {
        const row = messages.find((item) => item.id === where.id); if (row) { Object.assign(row, update); return row; } messages.push(create); return create;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Message> }) => { const row = messages.find((item) => item.id === where.id)!; Object.assign(row, data); return row; }),
    },
    brief: {
      findMany: vi.fn(async () => [...documents].reverse()),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; projectId: string } }) => [...documents].reverse().find((row) => row.projectId === where.projectId && (!where.id || row.id === where.id)) ?? null),
      count: vi.fn(async () => documents.length),
      create: vi.fn(async ({ data }: { data: Omit<BriefRow, "id" | "createdAt"> }) => { const row = { ...data, id: randomUUID(), createdAt: new Date() }; documents.push(row); return { id: row.id }; }),
    },
  };
  return { ...tx, $transaction: vi.fn(<T>(callback: (client: typeof tx) => Promise<T>) => {
    const result = sequence.then(() => callback(tx)); sequence = result.catch(() => undefined); return result;
  }) };
}

function seed(complete = false) {
  messages = [
    { id: "answer-1", projectId: project.id, role: "user", content: "Réservation de tables, budget 5 000 EUR, livraison le 15 janvier 2027.", metadata: null, createdAt: new Date(Date.now() - 10000) },
    { id: "assistant-1", projectId: project.id, role: "assistant", content: "Merci.", metadata: { analysis: { ...turn, completionScore: complete ? 100 : 0, missingInformation: complete ? [] : ["Budget à confirmer"], nextQuestion: complete ? null : turn.nextQuestion } }, createdAt: new Date(Date.now() - 9000) },
  ];
}
function tick() { vi.setSystemTime(Date.now() + 11000); }
function generate(requestId = randomUUID(), allowDraft = true) { return generateBrief("owner", project.id, { requestId, allowDraft, language: "fr" }); }

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  sequence = Promise.resolve(); documents = [];
  project = { id: "project-1", ownerId: "owner", name: "Restaurant test", type: "WEBSITE", description: "Réservation de tables", status: "INTERVIEW" };
  seed(); Object.assign(mocks.client, database());
  vi.mocked(runBriefGeneratorAgent).mockResolvedValue({ document: documentFixture(), model: "test-model" });
});
afterEach(() => vi.useRealTimers());

it.each([["intruder", "project-1"], ["owner", "missing"]])("isolates generation and reads for %s/%s", async (ownerId, id) => {
  await expect(listBriefs(ownerId, id)).rejects.toMatchObject({ status: 404 });
  await expect(getBrief(ownerId, id, "brief-1")).rejects.toMatchObject({ status: 404 });
  await expect(generateBrief(ownerId, id, { requestId: randomUUID(), allowDraft: true, language: "fr" })).rejects.toMatchObject({ status: 404 });
  expect(runBriefGeneratorAgent).not.toHaveBeenCalled();
});

it("requires an interview and explicit consent for an incomplete draft", async () => {
  await expect(generate(undefined, false)).rejects.toMatchObject({ code: "DRAFT_REQUIRED" });
  messages = [];
  await expect(generate()).rejects.toMatchObject({ code: "NO_INTERVIEW" });
  expect(documents).toHaveLength(0); expect(runBriefGeneratorAgent).not.toHaveBeenCalled();
});

it("persists validated JSON and derived Markdown as an identifiable draft", async () => {
  const result = await generate(); const saved = await getBrief("owner", project.id, result.briefId);
  expect(saved.generation.draft).toBe(true); expect(saved.generation.version).toBe(1);
  expect(saved.document.missingInformation.some((item) => item.description === "Budget à confirmer")).toBe(true);
  expect(documents[0].content).toContain("Brouillon"); expect(documents[0].content).toContain("Gestion des disponibilités");
  expect(project.status).toBe("INTERVIEW");
  expect((await getLatestBrief("owner", project.id))?.id).toBe(result.briefId);
});

it("updates project status for a complete document and preserves validated statuses", async () => {
  seed(true); vi.mocked(runBriefGeneratorAgent).mockResolvedValue({ document: documentFixture(true), model: "test-model" });
  await generate(undefined, false); expect(project.status).toBe("BRIEF_GENERATED");
  tick(); project.status = "VALIDATED"; project.description += " Nouvelle précision";
  await generate(undefined, false); expect(project.status).toBe("VALIDATED");
});

it("replays a request and unchanged sources without creating a duplicate or another paid call", async () => {
  const id = randomUUID(), first = await generate(id);
  expect((await generate(id)).briefId).toBe(first.briefId);
  const alias = randomUUID(); expect((await generate(alias)).briefId).toBe(first.briefId);
  project.description += " Modification";
  expect((await generate(alias)).briefId).toBe(first.briefId);
  expect(runBriefGeneratorAgent).toHaveBeenCalledOnce(); expect(documents).toHaveLength(1);
});

it("preserves the previous JSON and Markdown when regenerating a new source revision", async () => {
  const first = await generate(); const original = JSON.stringify(documents[0]); tick(); project.description += " Nouveau contenu client";
  const second = await generate();
  expect(second.briefId).not.toBe(first.briefId); expect(documents).toHaveLength(2);
  expect(JSON.stringify(documents[0])).toBe(original);
  expect((await getBrief("owner", project.id, second.briefId)).generation.version).toBe(2);
  expect((await listBriefs("owner", project.id)).briefs).toHaveLength(2);
});

it("retains paid attempts when a failed request later reuses another request's document", async () => {
  const id = randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    vi.mocked(runBriefGeneratorAgent).mockRejectedValueOnce(new InterviewError("BRIEF_REFUSAL", 422, "Refus"));
    await expect(generate(id)).rejects.toMatchObject({ code: "BRIEF_REFUSAL" });
    vi.setSystemTime(Date.now() + 61000);
  }
  const paid = messages.find((row) => (row.metadata as { requestId?: string })?.requestId === id)!;
  const chargedAt = paid.createdAt;
  const successful = await generate();
  expect((await generate(id)).briefId).toBe(successful.briefId);
  expect(paid.metadata).toMatchObject({ kind: "brief_request", attempts: 3, status: "completed" });
  expect(paid.createdAt).toEqual(chargedAt);
  expect(runBriefGeneratorAgent).toHaveBeenCalledTimes(4);
});

it("rejects changed payloads using the same request key", async () => {
  const id = randomUUID(); await generate(id);
  await expect(generateBrief("owner", project.id, { requestId: id, allowDraft: false, language: "fr" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
});

it("serializes concurrent generation claims without holding the transaction for the provider", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof runBriefGeneratorAgent>>) => void;
  vi.mocked(runBriefGeneratorAgent).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const first = generate(); while (!resolve) await Promise.resolve();
  await expect(generate()).rejects.toMatchObject({ code: "BRIEF_BUSY" });
  resolve({ document: documentFixture(), model: "test-model" }); await first;
  expect(documents).toHaveLength(1); expect(runBriefGeneratorAgent).toHaveBeenCalledOnce();
});

it("rejects output if source data changes during generation", async () => {
  vi.mocked(runBriefGeneratorAgent).mockImplementationOnce(async () => { project.description += " Modification concurrente"; return { document: documentFixture(), model: "test-model" }; });
  await expect(generate()).rejects.toMatchObject({ code: "BRIEF_SOURCE_CHANGED" }); expect(documents).toHaveLength(0);
});

it("never saves invalid or refused output and allows a bounded retry", async () => {
  const id = randomUUID(); vi.mocked(runBriefGeneratorAgent).mockRejectedValueOnce(new InterviewError("BRIEF_REFUSAL", 422, "Refus"));
  await expect(generate(id)).rejects.toMatchObject({ code: "BRIEF_REFUSAL" }); expect(documents).toHaveLength(0);
  tick(); await generate(id); expect(documents).toHaveLength(1);
});

it("revalidates output before persistence even if a provider adapter returns malformed data", async () => {
  vi.mocked(runBriefGeneratorAgent).mockResolvedValue({ document: {} as ReturnType<typeof documentFixture>, model: "test-model" });
  await expect(generate()).rejects.toThrow(); expect(documents).toHaveLength(0);
});

it("returns not-found for a brief id outside the selected project", async () => {
  await expect(getBrief("owner", project.id, "missing")).rejects.toMatchObject({ code: "BRIEF_NOT_FOUND" });
});

it("loads reader version headers without loading other documents", async () => {
  vi.mocked(mocks.client.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: "brief-1", title: "Version enregistrée", createdAt: new Date(), generation: { version: 3, draft: true, sourceRevision: "a".repeat(64) } }]);
  const reader = await getBriefReaderContext("owner", project.id);
  expect(reader.briefs[0]).toMatchObject({ id: "brief-1", version: 3, draft: true });
  const sql = vi.mocked(mocks.client.$queryRaw as ReturnType<typeof vi.fn>).mock.calls[0][0].join("?");
  expect(sql).toContain(`"json"->'generation'`);
  expect(sql).toContain('p."ownerId"');
  expect((mocks.client.brief as { findMany: ReturnType<typeof vi.fn> }).findMany).not.toHaveBeenCalled();
});

vi.mock("@/server/services/usage.service", () => ({ reserveUsage: vi.fn(async () => ({ id: "quota-ticket", userId: "owner" })), lockUsage: vi.fn(async () => {}) }));
vi.mock("@/server/ai/usage-context", () => ({ runMetered: (_ticket: unknown, action: () => Promise<unknown>) => action() }));
vi.mock("@/server/services/history-access.service", () => ({ historyLimit: async () => 50, assertHistoryAccess: async () => {} }));

it("bounds new cached aliases while preserving existing request replays and the next window", async () => {
  const firstId = randomUUID(), first = await generate(firstId);
  const alias = randomUUID(); await generate(alias);
  for (let index = 1; index < 99; index++) await generate();
  const concurrent = await Promise.allSettled([generate(), generate()]);
  expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(concurrent.filter((result) => result.status === "rejected")).toHaveLength(1);
  const count = messages.length;
  await expect(generate()).rejects.toMatchObject({ code: "REUSE_RATE_LIMIT", status: 429 });
  expect(messages).toHaveLength(count);
  expect((await generate(alias)).briefId).toBe(first.briefId);
  expect((await generate(firstId)).briefId).toBe(first.briefId);
  expect(messages).toHaveLength(count); expect(runBriefGeneratorAgent).toHaveBeenCalledOnce();
  vi.setSystemTime(Date.now() + 86400001);
  expect((await generate()).briefId).toBe(first.briefId);
});
