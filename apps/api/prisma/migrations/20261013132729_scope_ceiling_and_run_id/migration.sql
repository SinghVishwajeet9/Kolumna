-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "allowedScopes" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "SubtaskProposal" ADD COLUMN     "runId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SubtaskProposal_runId_key" ON "SubtaskProposal"("runId");

