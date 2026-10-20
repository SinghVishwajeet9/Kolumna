-- G14: an agent's access can end at a date or when a sprint is completed.
-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "accessSprintId" TEXT,
ADD COLUMN     "accessUntil" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_accessSprintId_fkey" FOREIGN KEY ("accessSprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

