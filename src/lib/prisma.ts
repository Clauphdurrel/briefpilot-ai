import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { runtimePoolConfig } from "@/server/database/connection.mjs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(runtimePoolConfig()),
  });

// Reuse one bounded pool per warm Node process, including production bundles.
globalForPrisma.prisma = prisma;
