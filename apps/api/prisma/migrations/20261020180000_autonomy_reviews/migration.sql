-- Phase 4: autonomy levels, per-board policies, confidence reviews.
-- CreateEnum
CREATE TYPE "AutonomyLevel" AS ENUM ('SUGGEST_ONLY', 'ACT_WITH_APPROVAL', 'ACT_AUTONOMOUS');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewReason" AS ENUM ('AUTONOMY_LEVEL', 'LOW_CONFIDENCE');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "autonomyLevel" "AutonomyLevel" NOT NULL DEFAULT 'ACT_WITH_APPROVAL',
ADD COLUMN     "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "reviewThreshold" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AutonomyPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "level" "AutonomyLevel" NOT NULL,
    "confidenceThreshold" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfidenceReview" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "cardId" TEXT,
    "toolName" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "reason" "ReviewReason" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "onBehalfOfActorId" TEXT,
    "reviewerActorId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfidenceReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutonomyPolicy_workspaceId_idx" ON "AutonomyPolicy"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomyPolicy_agentId_boardId_key" ON "AutonomyPolicy"("agentId", "boardId");

-- CreateIndex
CREATE INDEX "ConfidenceReview_workspaceId_status_idx" ON "ConfidenceReview"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ConfidenceReview_agentId_status_idx" ON "ConfidenceReview"("agentId", "status");

-- AddForeignKey
ALTER TABLE "AutonomyPolicy" ADD CONSTRAINT "AutonomyPolicy_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomyPolicy" ADD CONSTRAINT "AutonomyPolicy_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomyPolicy" ADD CONSTRAINT "AutonomyPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceReview" ADD CONSTRAINT "ConfidenceReview_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceReview" ADD CONSTRAINT "ConfidenceReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceReview" ADD CONSTRAINT "ConfidenceReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Agents that already exist keep the behaviour they were connected with
-- (they acted directly on their own cards). New agents start at the column
-- default, ACT_WITH_APPROVAL. A human can tighten either from the Agents page.
UPDATE "Agent" SET "autonomyLevel" = 'ACT_AUTONOMOUS';

-- Thresholds are probabilities.
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_confidenceThreshold_range" CHECK ("confidenceThreshold" >= 0 AND "confidenceThreshold" <= 1);
ALTER TABLE "AutonomyPolicy" ADD CONSTRAINT "AutonomyPolicy_confidenceThreshold_range" CHECK ("confidenceThreshold" IS NULL OR ("confidenceThreshold" >= 0 AND "confidenceThreshold" <= 1));
ALTER TABLE "Card" ADD CONSTRAINT "Card_reviewThreshold_range" CHECK ("reviewThreshold" IS NULL OR ("reviewThreshold" >= 0 AND "reviewThreshold" <= 1));
