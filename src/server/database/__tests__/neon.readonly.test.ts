import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadStagingEnvironment } from "../../../../scripts/staging-database.mjs";

// Explicit opt-in only; the default unit/CI campaigns never contact Neon.
// No fixtures, seed, mutations or cleanup are allowed in this shared environment.
describe.skipIf(process.env.NEON_READONLY_CHECK !== "1")("Neon staging read-only Prisma compatibility", () => {
  let client: PrismaClient | undefined;
  afterAll(async () => { await client?.$disconnect().catch(() => {}); });
  it("executes SELECT 1 and model reads inside a read-only transaction", async () => {
    try {
      const { connections } = loadStagingEnvironment();
      client = new PrismaClient({ adapter: new PrismaPg({ connectionString: connections.pooled, max: 1, connectionTimeoutMillis: 10000 }) });
      const result = await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const probe = await tx.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 AS ok");
        return { ok: probe[0]?.ok, users: await tx.user.count(), projects: await tx.project.count(), sessions: await tx.session.count(), usageLogs: await tx.aIUsageLog.count() };
      });
      expect(result.ok).toBe(1);
      for (const count of [result.users, result.projects, result.sessions, result.usageLogs]) expect(count).toBeGreaterThanOrEqual(0);
    } catch { throw new Error("Read-only Neon Prisma verification failed; provider details suppressed."); }
  }, 30000);
});
