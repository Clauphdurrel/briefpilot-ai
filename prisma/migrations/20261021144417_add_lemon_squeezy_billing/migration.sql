-- AlterEnum
ALTER TYPE "SubscriptionProvider" ADD VALUE 'LEMONSQUEEZY';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "accessEndsAt" TIMESTAMP(3),
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerCreatedAt" TIMESTAMP(3),
ADD COLUMN     "providerRevision" TEXT,
ADD COLUMN     "providerTestMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerVariantId" TEXT;

-- CreateTable
CREATE TABLE "BillingCheckoutIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "providerCheckoutId" TEXT,
    "providerSubscriptionId" TEXT,
    "url" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutIntent_providerCheckoutId_key" ON "BillingCheckoutIntent"("providerCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutIntent_providerSubscriptionId_key" ON "BillingCheckoutIntent"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "BillingCheckoutIntent_userId_expiresAt_idx" ON "BillingCheckoutIntent"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_providerSubscriptionId_createdAt_idx" ON "BillingWebhookEvent"("providerSubscriptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingCheckoutIntent" ADD CONSTRAINT "BillingCheckoutIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
