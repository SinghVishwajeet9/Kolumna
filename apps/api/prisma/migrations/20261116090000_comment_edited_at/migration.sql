-- Comments can now be edited by their author; editedAt marks one that was.
ALTER TABLE "Comment" ADD COLUMN "editedAt" TIMESTAMP(3);
