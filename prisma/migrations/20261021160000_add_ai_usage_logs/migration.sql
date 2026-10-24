ALTER TABLE "User" ADD COLUMN "analyticsConsent" BOOLEAN NOT NULL DEFAULT false;

-- Additive technical telemetry; deletion of users/projects anonymizes their references.
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "requestId" TEXT,
    "operationId" TEXT,
    "userId" TEXT,
    "projectId" TEXT,
    "agent" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCost" DECIMAL(20,12),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "pricingVersion" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "usageStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIUsageLog_attemptId_key" ON "AIUsageLog"("attemptId");
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");
CREATE INDEX "AIUsageLog_userId_createdAt_idx" ON "AIUsageLog"("userId", "createdAt");
CREATE INDEX "AIUsageLog_projectId_createdAt_idx" ON "AIUsageLog"("projectId", "createdAt");
CREATE INDEX "AIUsageLog_operationId_idx" ON "AIUsageLog"("operationId");
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
