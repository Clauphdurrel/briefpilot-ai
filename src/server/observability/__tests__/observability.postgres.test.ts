import "dotenv/config";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import OpenAI from "openai";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { monitorAI } from "../ai-monitoring";
import { withOperation, currentOperation } from "../context";
import { reserveUsage, getRemainingQuota } from "@/server/services/usage.service";
import { runMetered, meterProvider } from "@/server/ai/usage-context";
import { pruneAIUsage } from "../../../../scripts/prune-ai-usage.mjs";

describe.skipIf(process.env.BILLING_INTEGRATION !== "1")("isolated PostgreSQL observability", () => {
  const ids: string[] = [];
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!);
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
    expect(url.pathname).toMatch(/^\/briefpilot_test_[a-f0-9]{32}$/);
  });
  beforeEach(() => { vi.stubEnv("OBSERVABILITY_ENABLED", "true"); vi.stubEnv("AI_MONITORING_ENABLED", "true"); });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await prisma.aIUsageLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.splice(0) } } });
  });
  afterAll(async () => { await pool.end(); });
  async function user() {
    const id = randomUUID(); ids.push(id);
    await prisma.user.create({ data: { id, email: `${id}@example.invalid` } });
    return id;
  }
  const params = { model: "gpt-4.1-mini", text: { format: { name: "interview_turn" } }, input: "PRIVATE PROMPT" };
  const response = () => ({ model: "gpt-4.1-mini", status: "completed", service_tier: "default",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 100, total_tokens: 1100 }, output: [], output_parsed: { private: "PRIVATE OUTPUT" } });

  it("persists correlated measured usage and charges one quota unit for one invocation", async () => {
    const id = await user(), project = await prisma.project.create({ data: { ownerId: id, name: "Synthetic metrics project", type: "WEBSITE" } });
    const ticket = await reserveUsage(id, "AI_INTERVIEW", randomUUID()), result = response(), action = vi.fn(async () => result);
    const saved = await withOperation({ userId: id, projectId: project.id }, async () => {
      const context = currentOperation()!;
      expect(await runMetered(ticket, () => meterProvider(() => monitorAI(params, action)))).toBe(result);
      return { context, row: await prisma.aIUsageLog.findFirstOrThrow({ where: { userId: id } }) };
    });
    expect(action).toHaveBeenCalledOnce();
    expect(saved.row).toMatchObject({ requestId: saved.context.requestId, operationId: saved.context.operationId, projectId: project.id,
      inputTokens: 1000, cachedInputTokens: 200, outputTokens: 100, totalTokens: 1100, usageStatus: "KNOWN", status: "SUCCESS" });
    expect(saved.row.estimatedCost?.toString()).toBe("0.0005");
    expect(JSON.stringify(saved.row)).not.toContain("PRIVATE");
    expect(await prisma.aIUsageLog.count({ where: { userId: id } })).toBe(1);
    expect(await getRemainingQuota(id, "AI_INTERVIEW")).toBe(2);
    expect(await prisma.usageEvent.count({ where: { userId: id, status: "COMMITTED" } })).toBe(1);
  });
  it("retains an unknown-cost timeout as a charged attempt with no invented usage", async () => {
    const id = await user(), ticket = await reserveUsage(id, "AI_INTERVIEW", randomUUID());
    const error = new OpenAI.APIConnectionTimeoutError({ message: "PRIVATE TIMEOUT" });
    await expect(runMetered(ticket, () => meterProvider(() => monitorAI(params, async () => { throw error; })))).rejects.toBe(error);
    const row = await prisma.aIUsageLog.findFirstOrThrow({ where: { userId: id } });
    expect(row).toMatchObject({ status: "ERROR", errorCode: "AI_TIMEOUT", inputTokens: null, totalTokens: null, estimatedCost: null, usageStatus: "UNKNOWN" });
    expect(await getRemainingQuota(id, "AI_INTERVIEW")).toBe(2);
  });
  it("preserves generation success and quota accounting when telemetry violates a database FK", async () => {
    const id = await user(), ticket = await reserveUsage(id, "AI_INTERVIEW", randomUUID()), result = response();
    await withOperation({ userId: id, projectId: "nonexistent-synthetic-project" }, async () => {
      expect(await runMetered(ticket, () => meterProvider(() => monitorAI(params, async () => result)))).toBe(result);
    });
    expect(await prisma.aIUsageLog.count({ where: { userId: id } })).toBe(0);
    expect(await getRemainingQuota(id, "AI_INTERVIEW")).toBe(2);
  });
  it("prunes only old technical logs and keeps recent logs, quotas and documents", async () => {
    const id = await user(), now = new Date(), ticket = await reserveUsage(id, "AI_INTERVIEW", randomUUID());
    await runMetered(ticket, () => meterProvider(async () => "synthetic result"));
    const project = await prisma.project.create({ data: { ownerId: id, name: "Retention project", type: "WEBSITE" } });
    for (const age of [100, 100, 100, 0]) await prisma.aIUsageLog.create({ data: { attemptId: randomUUID(), userId: id, projectId: project.id, agent: "InterviewClientAgent", model: "synthetic-model", durationMs: 1, status: "SUCCESS", usageStatus: "UNKNOWN", createdAt: new Date(now.getTime() - age * 86400000) } });
    const before = JSON.stringify(await prisma.usageEvent.findMany({ where: { userId: id } }));
    expect(await pruneAIUsage(pool, { days: 90 }, now)).toMatchObject({ mode: "dry-run", eligible: 3, deleted: 0 });
    expect(await prisma.aIUsageLog.count({ where: { userId: id } })).toBe(4);
    expect(await pruneAIUsage(pool, { days: 90, apply: true }, now)).toMatchObject({ mode: "apply", deleted: 3 });
    expect(await prisma.aIUsageLog.count({ where: { userId: id } })).toBe(1);
    expect(JSON.stringify(await prisma.usageEvent.findMany({ where: { userId: id } }))).toBe(before);
    expect(await getRemainingQuota(id, "AI_INTERVIEW")).toBe(2);
    expect(await prisma.project.count({ where: { id: project.id } })).toBe(1);
  });
  it("reports unknown costs explicitly through the operator CLI without identities or content", async () => {
    const id = await user();
    await prisma.aIUsageLog.create({ data: { attemptId: randomUUID(), userId: id, agent: "UnknownAgent", model: "synthetic-report-model", durationMs: 1, status: "ERROR", usageStatus: "UNKNOWN" } });
    const output = execFileSync(process.execPath, ["scripts/ai-usage-report.mjs"], { env: { ...process.env, AI_USAGE_REPORT_DAYS: "30" }, encoding: "utf8" });
    const report = JSON.parse(output), row = report.rows.find((item: { model: string }) => item.model === "synthetic-report-model");
    expect(report.estimatesOnly).toBe(true); expect(row).toMatchObject({ unknownCostAttempts: 1, measuredInputTokens: null, estimatedUSD: null });
    expect(output).not.toContain(id); expect(output).not.toContain("@example.invalid");
  });
});
