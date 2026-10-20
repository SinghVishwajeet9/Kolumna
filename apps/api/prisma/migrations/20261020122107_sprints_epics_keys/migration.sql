-- Phase 3.5: card keys, priority, story points, epics, sprints, and the
-- database-level tenant guarantee (roadmap G12).
--
-- Written by hand, not taken from `prisma migrate diff`: the generated script
-- adds NOT NULL columns with no value for rows that already exist, which
-- fails on real data. This version adds them nullable, BACKFILLS, then
-- tightens — the safe add -> backfill -> enforce order.

-- 1. New types and tables -----------------------------------------------------
CREATE TYPE "Priority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

CREATE TABLE "Epic" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#c4b5fd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Epic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- 2. New columns, nullable for now -------------------------------------------
ALTER TABLE "Board" ADD COLUMN "key" TEXT,
ADD COLUMN "nextCardNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Card" ADD COLUMN "boardId" TEXT,
ADD COLUMN "number" INTEGER,
ADD COLUMN "epicId" TEXT,
ADD COLUMN "sprintId" TEXT,
ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'NONE',
ADD COLUMN "storyPoints" INTEGER;

-- 3. Backfill ------------------------------------------------------------------
-- A card's board is its list's board.
UPDATE "Card" c SET "boardId" = l."boardId" FROM "List" l WHERE l."id" = c."listId";

-- Number existing cards per board in creation order: PRM-1, PRM-2, ...
UPDATE "Card" c SET "number" = n.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "boardId" ORDER BY "createdAt", "id") AS rn
  FROM "Card"
) n
WHERE n."id" = c."id";

UPDATE "Board" b SET "nextCardNumber" = COALESCE(m.maxn, 0) + 1
FROM (SELECT "boardId", MAX("number") AS maxn FROM "Card" GROUP BY "boardId") m
WHERE m."boardId" = b."id";

-- Board keys from titles — same rule as boardKeyFromTitle() in the API:
-- 2+ words -> initials of the first 4 ("Product Road Map" -> PRM),
-- 1 word -> its first 3 letters ("roadmap" -> ROA), nothing usable -> B.
-- Duplicates within a workspace get a number suffix (PRM, PRM2, ...).
UPDATE "Board" b SET "key" = k.final
FROM (
  SELECT "id", base || CASE WHEN rn > 1 THEN rn::text ELSE '' END AS final
  FROM (
    SELECT "id", base,
           row_number() OVER (PARTITION BY "workspaceId", base ORDER BY "createdAt", "id") AS rn
    FROM (
      SELECT b2."id", b2."workspaceId", b2."createdAt",
             COALESCE(NULLIF(
               CASE WHEN count(w.word) >= 2
                    THEN upper(string_agg(left(w.word, 1), '' ORDER BY w.ord) FILTER (WHERE w.ord <= 4))
                    ELSE upper(left(max(w.word), 3))
               END, ''), 'B') AS base
      FROM "Board" b2
      LEFT JOIN LATERAL unnest(
        regexp_split_to_array(trim(regexp_replace(b2."title", '[^A-Za-z0-9]+', ' ', 'g')), ' ')
      ) WITH ORDINALITY AS w(word, ord) ON w.word <> ''
      GROUP BY b2."id"
    ) x
  ) y
) k
WHERE b."id" = k."id";

-- 4. Enforce -------------------------------------------------------------------
ALTER TABLE "Board" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "Card" ALTER COLUMN "boardId" SET NOT NULL;
ALTER TABLE "Card" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX "Board_workspaceId_key_key" ON "Board"("workspaceId", "key");
CREATE UNIQUE INDEX "Board_id_workspaceId_key" ON "Board"("id", "workspaceId");
CREATE UNIQUE INDEX "List_id_boardId_workspaceId_key" ON "List"("id", "boardId", "workspaceId");
CREATE UNIQUE INDEX "Card_boardId_number_key" ON "Card"("boardId", "number");
CREATE INDEX "Card_sprintId_idx" ON "Card"("sprintId");
CREATE INDEX "Card_epicId_idx" ON "Card"("epicId");
CREATE INDEX "Epic_boardId_idx" ON "Epic"("boardId");
CREATE INDEX "Epic_workspaceId_idx" ON "Epic"("workspaceId");
CREATE INDEX "Sprint_boardId_idx" ON "Sprint"("boardId");
CREATE INDEX "Sprint_workspaceId_idx" ON "Sprint"("workspaceId");

-- At most ONE active sprint per board, guaranteed by the database. Prisma
-- can't express a partial (WHERE) unique index, so it lives only here.
CREATE UNIQUE INDEX "Sprint_one_active_per_board" ON "Sprint"("boardId") WHERE "status" = 'ACTIVE';

-- Composite foreign keys (G12). Adding them validates every existing row, so
-- a cross-tenant card already in the data would make this migration fail
-- loudly instead of being locked in.
ALTER TABLE "List" DROP CONSTRAINT "List_boardId_fkey";
ALTER TABLE "Card" DROP CONSTRAINT "Card_listId_fkey";

ALTER TABLE "List" ADD CONSTRAINT "List_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_listId_boardId_workspaceId_fkey" FOREIGN KEY ("listId", "boardId", "workspaceId") REFERENCES "List"("id", "boardId", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
