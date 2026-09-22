-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SubtaskProposal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "proposedByActorId" TEXT NOT NULL,
    "subtasks" JSONB NOT NULL,
    "reasoningSummary" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByActorId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubtaskProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubtaskProposal_workspaceId_idx" ON "SubtaskProposal"("workspaceId");

-- CreateIndex
CREATE INDEX "SubtaskProposal_cardId_idx" ON "SubtaskProposal"("cardId");

-- AddForeignKey
ALTER TABLE "SubtaskProposal" ADD CONSTRAINT "SubtaskProposal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtaskProposal" ADD CONSTRAINT "SubtaskProposal_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

