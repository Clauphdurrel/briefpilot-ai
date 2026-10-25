import { expect, it, vi } from "vitest";
import { pruneAIUsage } from "../../../../scripts/prune-ai-usage.mjs";
it("defaults to a dry run and never changes usage ledgers or documents", async () => {
  const query = vi.fn<(sql: string, params: unknown[]) => Promise<{ rows: { count: number }[] }>>(async () => ({ rows: [{ count: 5 }] }));
  const result = await pruneAIUsage({ query }, {}, new Date("2026-10-24T00:00:00Z"));
  expect(result).toMatchObject({ mode: "dry-run", eligible: 5, deleted: 0 });
  expect(query).toHaveBeenCalledOnce(); expect(query.mock.calls[0][0]).toMatch(/^SELECT .*"AIUsageLog"/);
});
it.each([0, 6, 366, "not-a-number"])("rejects an unsafe retention interval %s before database access", async (days) => {
  const query = vi.fn(); await expect(pruneAIUsage({ query }, { days, apply: true })).rejects.toThrow(); expect(query).not.toHaveBeenCalled();
});
it("bounds an apply run to ten batches of old metric rows", async () => {
  const query = vi.fn<(sql: string, params: unknown[]) => Promise<{ rowCount: number }>>(async () => ({ rowCount: 1000 }));
  expect(await pruneAIUsage({ query }, { days: 90, apply: true })).toMatchObject({ mode: "apply", deleted: 10000, batchLimitReached: true });
  expect(query).toHaveBeenCalledTimes(10);
  for (const [sql] of query.mock.calls) { expect(sql).toMatch(/^DELETE FROM "AIUsageLog"/); expect(sql).toContain('"createdAt" < $1'); expect(sql).not.toMatch(/UsageEvent|UsageCounter|Project|Brief|Backlog/); }
});
