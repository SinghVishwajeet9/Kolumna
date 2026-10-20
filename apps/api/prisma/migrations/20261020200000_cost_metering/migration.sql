-- Phase 5: cost events, model prices, usage budgets.
-- CreateEnum
CREATE TYPE "CostSource" AS ENUM ('SELF_REPORTED', 'HOSTED_RUN', 'MANUAL');

-- AlterEnum
ALTER TYPE "ReviewReason" ADD VALUE 'BUDGET_EXCEEDED';

-- CreateTable
CREATE TABLE "CostEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "actorId" TEXT NOT NULL,
    "cardId" TEXT,
    "boardId" TEXT,
    "sprintId" TEXT,
    "epicId" TEXT,
    "source" "CostSource" NOT NULL,
    "model" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(14,6),
    "note" TEXT,
    "reportedByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPrice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputPerMTokUsd" DECIMAL(12,6) NOT NULL,
    "outputPerMTokUsd" DECIMAL(12,6) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageBudget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sprintId" TEXT,
    "agentId" TEXT,
    "costCapUsd" DECIMAL(14,2),
    "tokenCap" INTEGER,
    "alertAt" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "alertedAt" TIMESTAMP(3),
    "exceededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostEvent_workspaceId_createdAt_idx" ON "CostEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CostEvent_sprintId_idx" ON "CostEvent"("sprintId");

-- CreateIndex
CREATE INDEX "CostEvent_epicId_idx" ON "CostEvent"("epicId");

-- CreateIndex
CREATE INDEX "CostEvent_cardId_idx" ON "CostEvent"("cardId");

-- CreateIndex
CREATE INDEX "CostEvent_agentId_createdAt_idx" ON "CostEvent"("agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPrice_workspaceId_model_key" ON "ModelPrice"("workspaceId", "model");

-- CreateIndex
CREATE INDEX "UsageBudget_workspaceId_idx" ON "UsageBudget"("workspaceId");

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPrice" ADD CONSTRAINT "ModelPrice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageBudget" ADD CONSTRAINT "UsageBudget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageBudget" ADD CONSTRAINT "UsageBudget_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageBudget" ADD CONSTRAINT "UsageBudget_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Spend is never negative, and a budget limits something.
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_nonnegative" CHECK ("tokensIn" >= 0 AND "tokensOut" >= 0 AND ("costUsd" IS NULL OR "costUsd" >= 0));
ALTER TABLE "UsageBudget" ADD CONSTRAINT "UsageBudget_has_cap" CHECK ("costCapUsd" IS NOT NULL OR "tokenCap" IS NOT NULL);
ALTER TABLE "UsageBudget" ADD CONSTRAINT "UsageBudget_alert_range" CHECK ("alertAt" > 0 AND "alertAt" <= 1);
