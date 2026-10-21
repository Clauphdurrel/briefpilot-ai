-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'AGENCY', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('NONE', 'STRIPE');

-- CreateEnum
CREATE TYPE "UsageResource" AS ENUM ('AI_INTERVIEW', 'AI_BRIEF', 'AI_BACKLOG', 'PDF_EXPORT', 'ACTIVE_PROJECTS');

-- CreateEnum
CREATE TYPE "UsageStatus" AS ENUM ('RESERVED', 'STARTED', 'COMMITTED', 'RELEASED');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL DEFAULT 'NONE',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "limitOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" "UsageResource" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" "UsageResource" NOT NULL,
    "operationId" TEXT NOT NULL,
    "status" "UsageStatus" NOT NULL DEFAULT 'RESERVED',
    "units" INTEGER NOT NULL DEFAULT 1,
    "counterId" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_resource_periodStart_periodEnd_key" ON "UsageCounter"("userId", "resource", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_status_leaseUntil_idx" ON "UsageEvent"("userId", "status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_userId_resource_operationId_key" ON "UsageEvent"("userId", "resource", "operationId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "UsageCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
