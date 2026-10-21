-- CreateEnum
CREATE TYPE "BacklogStatus" AS ENUM ('DRAFT', 'READY');

-- CreateTable
CREATE TABLE "Backlog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceBriefId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "BacklogStatus" NOT NULL,
    "data" JSONB NOT NULL,
    "sourceRevision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Backlog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacklogGeneration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "sourceRevision" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "chargedAt" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "lastAttemptAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "backlogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacklogGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Backlog_sourceBriefId_idx" ON "Backlog"("sourceBriefId");

-- CreateIndex
CREATE INDEX "Backlog_projectId_sourceRevision_idx" ON "Backlog"("projectId", "sourceRevision");

-- CreateIndex
CREATE UNIQUE INDEX "Backlog_projectId_version_key" ON "Backlog"("projectId", "version");

-- CreateIndex
CREATE INDEX "BacklogGeneration_projectId_lastAttemptAt_idx" ON "BacklogGeneration"("projectId", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "BacklogGeneration_projectId_requestId_key" ON "BacklogGeneration"("projectId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Brief_id_projectId_key" ON "Brief"("id", "projectId");

-- AddForeignKey
ALTER TABLE "Backlog" ADD CONSTRAINT "Backlog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backlog" ADD CONSTRAINT "Backlog_sourceBriefId_projectId_fkey" FOREIGN KEY ("sourceBriefId", "projectId") REFERENCES "Brief"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacklogGeneration" ADD CONSTRAINT "BacklogGeneration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacklogGeneration" ADD CONSTRAINT "BacklogGeneration_backlogId_fkey" FOREIGN KEY ("backlogId") REFERENCES "Backlog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

