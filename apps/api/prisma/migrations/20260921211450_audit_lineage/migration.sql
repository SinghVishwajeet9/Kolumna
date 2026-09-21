-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "onBehalfOfActorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "toolInvoked" TEXT,
    "resource" TEXT,
    "result" TEXT NOT NULL,
    "reasoningSummary" TEXT,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditEntry_hash_key" ON "AuditEntry"("hash");

-- CreateIndex
CREATE INDEX "AuditEntry_workspaceId_idx" ON "AuditEntry"("workspaceId");

-- CreateIndex
CREATE INDEX "AuditEntry_targetType_targetId_idx" ON "AuditEntry"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEntry_workspaceId_seq_key" ON "AuditEntry"("workspaceId", "seq");

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_onBehalfOfActorId_fkey" FOREIGN KEY ("onBehalfOfActorId") REFERENCES "Actor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

