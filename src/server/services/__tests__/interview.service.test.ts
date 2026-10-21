import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runInterviewClientAgent } from "@/server/agents/interview-client.agent";
import { turn } from "@/server/agents/__tests__/fixtures";
import { InterviewError } from "@/server/ai/errors";
import { advanceInterview, getInterview } from "../interview.service";

const mocks = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.client }));
vi.mock("@/server/agents/interview-client.agent", () => ({ runInterviewClientAgent: vi.fn() }));

type Row = { id: string; projectId: string; role: string; content: string; metadata: object | null; createdAt: Date };
let rows: Row[];
let project: { id: string; ownerId: string; name: string; type: string; description: string; status: string };
let now: number;
let sequence: Promise<unknown>;

function fakeDb() {
  const tx = {
    $queryRaw: vi.fn(async () => [{ locked: 1 }]),
    project: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; ownerId: string } }) =>
        where.id === project.id && where.ownerId === project.ownerId ? project : null),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        if (project.status === where.status) project.status = data.status;
        return { count: 1 };
      }),
    },
    interviewMessage: {
      findMany: vi.fn(async ({ where, take = 200 }: { where: { projectId?: string; role: string | { in: string[] }; createdAt?: { gte: Date } }; take?: number }) => {
        const result = rows.filter((row) => (!where.projectId || row.projectId === where.projectId) &&
          (typeof where.role === "string" ? row.role === where.role : where.role.in.includes(row.role)) &&
          (!where.createdAt || row.createdAt >= where.createdAt.gte));
        return [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take);
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { id: string }; create: Row; update: Partial<Row> }) => {
        const row = rows.find((item) => item.id === where.id);
        if (row) { Object.assign(row, update); return row; }
        rows.push(create); return create;
      }),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { ...data, id: randomUUID() }; rows.push(row); return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error("Missing test row");
        Object.assign(row, data); return row;
      }),
    },
  };
  return {
    ...tx,
    $transaction: vi.fn(<T>(callback: (client: typeof tx) => Promise<T>) => {
      const result = sequence.then(() => callback(tx));
      sequence = result.catch(() => undefined);
      return result;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks(); rows = []; sequence = Promise.resolve();
  now = Date.parse("2026-10-20T12:00:00Z");
  vi.spyOn(Date, "now").mockImplementation(() => now);
  // Fake the Date constructor too, while preserving promises and real timers.
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  project = { id: "project-1", ownerId: "owner", name: "Projet test", type: "SAAS", description: "Description", status: "DRAFT" };
  Object.assign(mocks.client, fakeDb());
  vi.mocked(runInterviewClientAgent).mockResolvedValue({ analysis: turn, model: "test-model" });
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function tick(milliseconds = 4000) { now += milliseconds; vi.setSystemTime(now); }
function start(requestId = randomUUID()) { return advanceInterview("owner", project.id, { requestId, language: "fr" }, "start"); }

describe("interview persistence and permissions", () => {
  it("returns an empty interview without starting a paid call", async () => {
    expect(await getInterview("owner", project.id)).toEqual({ analysis: null, messages: [], completionScore: null, missingInformation: [] });
    expect(runInterviewClientAgent).not.toHaveBeenCalled();
  });

  it.each([["owner", "missing"], ["intruder", "project-1"]])("rejects missing or foreign project %s/%s", async (owner, id) => {
    await expect(getInterview(owner, id)).rejects.toMatchObject({ status: 404 });
    await expect(advanceInterview(owner, id, { requestId: randomUUID(), language: "fr" }, "start")).rejects.toMatchObject({ status: 404 });
    expect(runInterviewClientAgent).not.toHaveBeenCalled();
  });

  it("starts once, stores assistant analysis and resumes without another OpenAI call", async () => {
    const requestId = randomUUID();
    const first = await start(requestId);
    expect(first.messages).toHaveLength(1);
    expect(first.messages[0].content).toBe(turn.message);
    expect(first.completionScore).toBe(0);
    expect(project.status).toBe("INTERVIEW");
    expect(await start(requestId)).toEqual(first);
    expect(await start()).toEqual(first);
    expect(await getInterview("owner", project.id)).toEqual(first);
    expect(runInterviewClientAgent).toHaveBeenCalledOnce();
  });

  it("stores a reply and its assistant response atomically and deduplicates technical replay", async () => {
    const first = await start(); tick();
    const message = { requestId: randomUUID(), language: "fr" as const, content: "Agences immobilières", expectedLastMessageId: first.messages[0].id };
    const next = await advanceInterview("owner", project.id, message, "message");
    expect(next.messages.map((item) => item.role)).toEqual(["assistant", "user", "assistant"]);
    expect(vi.mocked(runInterviewClientAgent).mock.calls[1][0]).toMatchObject({
      history: [{ role: "assistant", content: turn.message }, { role: "user", content: message.content }], previousAnalysis: turn,
    });
    expect(await advanceInterview("owner", project.id, message, "message")).toEqual(next);
    expect(rows.filter((row) => row.role === "user")).toHaveLength(1);
    expect(runInterviewClientAgent).toHaveBeenCalledTimes(2);
  });

  it("rejects reuse of a request id with different contents", async () => {
    const requestId = randomUUID(); await start(requestId);
    await expect(advanceInterview("owner", project.id, { requestId, language: "en" }, "start")).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(runInterviewClientAgent).toHaveBeenCalledOnce();
  });

  it("rejects stale answers from another tab before charging a call", async () => {
    await start(); tick();
    await expect(advanceInterview("owner", project.id, { requestId: randomUUID(), language: "fr", content: "Réponse", expectedLastMessageId: "stale" }, "message")).rejects.toMatchObject({ code: "STALE_INTERVIEW" });
    expect(runInterviewClientAgent).toHaveBeenCalledOnce();
  });

  it("keeps the project in DRAFT after an OpenAI failure and permits a bounded retry", async () => {
    const requestId = randomUUID();
    vi.mocked(runInterviewClientAgent).mockRejectedValueOnce(new InterviewError("AI_TIMEOUT", 504, "Délai dépassé"));
    await expect(start(requestId)).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    expect(project.status).toBe("DRAFT");
    expect((await getInterview("owner", project.id)).messages).toHaveLength(0);
    tick();
    expect((await start(requestId)).messages).toHaveLength(1);
    expect(rows.filter((row) => row.role === "system")).toHaveLength(1);
  });

  it("blocks concurrent requests while releasing the database transaction during the model call", async () => {
    let complete!: (value: { analysis: typeof turn; model: string }) => void;
    vi.mocked(runInterviewClientAgent).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const active = start();
    while (!complete) await Promise.resolve();
    await expect(start()).rejects.toMatchObject({ code: "INTERVIEW_BUSY" });
    complete({ analysis: turn, model: "test-model" });
    await active;
    expect(runInterviewClientAgent).toHaveBeenCalledOnce();
  });

  it("limits retries of a failed request to three attempts", async () => {
    vi.mocked(runInterviewClientAgent).mockRejectedValue(new InterviewError("AI_TIMEOUT", 504, "Délai"));
    const requestId = randomUUID();
    for (let i = 0; i < 3; i++) { await expect(start(requestId)).rejects.toMatchObject({ code: "AI_TIMEOUT" }); tick(61000); }
    await expect(start(requestId)).rejects.toMatchObject({ code: "RETRY_LIMIT" });
    expect(runInterviewClientAgent).toHaveBeenCalledTimes(3);
  });

  it("protects against calls repeated faster than the cooldown", async () => {
    const first = await start();
    await expect(advanceInterview("owner", project.id, { requestId: randomUUID(), language: "fr", content: "Réponse", expectedLastMessageId: first.messages[0].id }, "message")).rejects.toMatchObject({ code: "RATE_LIMIT" });
  });

  it("preserves other project statuses", async () => {
    project.status = "VALIDATED";
    await start(); expect(project.status).toBe("VALIDATED");
  });

  it.each([[5, 10000], [40, 3600000]])("enforces persisted owner rate limits for %s recent attempts", async (count, age) => {
    for (let i = 0; i < count; i++) rows.push({
      id: randomUUID(), projectId: project.id, role: "system", content: "", createdAt: new Date(now - age),
      metadata: { kind: "interview_request", requestId: randomUUID(), hash: "test", status: "failed", attempts: 1, leaseUntil: new Date(now - age).toISOString() },
    });
    await expect(start()).rejects.toMatchObject({ code: "RATE_LIMIT" });
    expect(runInterviewClientAgent).not.toHaveBeenCalled();
  });

  it("caps the number of persisted visible messages", async () => {
    for (let i = 0; i < 200; i++) rows.push({ id: `old-${i}`, projectId: project.id, role: "user", content: "Réponse", metadata: null, createdAt: new Date(now - 100000 + i) });
    await expect(start()).rejects.toMatchObject({ code: "HISTORY_LIMIT" });
    expect(runInterviewClientAgent).not.toHaveBeenCalled();
  });

  it("does not persist a response after its request lease expires", async () => {
    vi.mocked(runInterviewClientAgent).mockImplementationOnce(async () => { tick(91000); return { analysis: turn, model: "test-model" }; });
    await expect(start()).rejects.toMatchObject({ code: "STALE_REQUEST" });
    expect((await getInterview("owner", project.id)).messages).toHaveLength(0);
  });

  it("sends a bounded history while preserving the last confirmed analysis", async () => {
    for (let i = 0; i < 30; i++) rows.push({ id: `old-${i}`, projectId: project.id, role: "assistant", content: "x".repeat(2000), metadata: { analysis: turn }, createdAt: new Date(now - 100000 + i) });
    const first = await getInterview("owner", project.id);
    await advanceInterview("owner", project.id, { requestId: randomUUID(), language: "fr", content: "Réponse récente", expectedLastMessageId: first.messages.at(-1)!.id }, "message");
    const context = vi.mocked(runInterviewClientAgent).mock.calls[0][0] as { history: { content: string }[]; previousAnalysis: unknown };
    expect(context.history.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(32000);
    expect(context.history.at(-1)?.content).toBe("Réponse récente");
    expect(context.previousAnalysis).toEqual(turn);
  });
});
