-- Phase 6: completion tracking for burndown, sprint capacity, agent reliability snapshots.
-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "doneAssigneeId" TEXT,
ADD COLUMN     "doneAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "carriedOverPoints" INTEGER,
ADD COLUMN     "humanCapacityHours" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AgentReliability" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "cardsDone" INTEGER NOT NULL,
    "pointsDone" INTEGER NOT NULL,
    "reopened" INTEGER NOT NULL,
    "reviewsDecided" INTEGER NOT NULL,
    "reviewsApproved" INTEGER NOT NULL,
    "approvalRate" DOUBLE PRECISION,
    "reopenRate" DOUBLE PRECISION,
    "avgConfidence" DOUBLE PRECISION,
    "deniedCalls" INTEGER NOT NULL,
    "toolCalls" INTEGER NOT NULL,
    "costUsd" DECIMAL(14,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentReliability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentReliability_workspaceId_idx" ON "AgentReliability"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentReliability_agentId_sprintId_key" ON "AgentReliability"("agentId", "sprintId");

-- AddForeignKey
ALTER TABLE "AgentReliability" ADD CONSTRAINT "AgentReliability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReliability" ADD CONSTRAINT "AgentReliability_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReliability" ADD CONSTRAINT "AgentReliability_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: cards already sitting in their board's done (last) column were
-- done when they last moved there, by whoever had them. The audit log knows
-- when they last moved; cards never moved were created there.
UPDATE "Card" c
SET "doneAt" = COALESCE(
      (SELECT max(a."createdAt") FROM "AuditEntry" a
        WHERE a."targetId" = c."id" AND a."action" IN ('CARD.MOVE', 'AGENT.MOVE_TICKET') AND a."result" = 'SUCCESS'),
      c."createdAt"),
    "doneAssigneeId" = c."assigneeId"
WHERE c."listId" = (
  SELECT l."id" FROM "List" l WHERE l."boardId" = c."boardId" ORDER BY l."rank" DESC LIMIT 1
);

ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_humanCapacityHours_nonnegative" CHECK ("humanCapacityHours" IS NULL OR "humanCapacityHours" >= 0);
