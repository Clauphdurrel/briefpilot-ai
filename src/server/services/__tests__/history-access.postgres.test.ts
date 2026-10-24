import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertHistoryAccess, historyLimit } from "../history-access.service";
import { getPlanFeatures, getPlanLimits } from "../subscription.service";

describe.skipIf(process.env.BILLING_INTEGRATION !== "1")("history reads inside a single-connection PostgreSQL transaction", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1, connectionTimeoutMillis: 1000 }) });
  afterAll(async () => { await db.$disconnect(); });
  it("uses the supplied transaction for plan and document access without acquiring another connection", async () => {
    const id = randomUUID();
    try {
      await db.user.create({ data: { id, email: `${id}@example.invalid` } });
      await db.$transaction(async (tx) => {
        const project = await tx.project.create({ data: { ownerId: id, name: "Single connection test", type: "WEBSITE" } });
        const brief = await tx.brief.create({ data: { projectId: project.id, title: "Test", content: "Test" } });
        await expect(assertHistoryAccess(id, project.id, "brief", brief.id, tx)).resolves.toBeUndefined();
        expect(await historyLimit(id, tx)).toBe(2);
        expect((await getPlanFeatures(id, tx)).historyVersions).toBe(2);
        expect((await getPlanLimits(id, tx)).ACTIVE_PROJECTS).toBe(2);
      }, { timeout: 4000 });
    } finally { await db.user.deleteMany({ where: { id } }); }
  });
});
