// THE most important test in this project. See ARCHITECTURE.md §6, Decision 1
// and CONCEPTS.md §4.8.
//
// Kolumna is multi-tenant with a shared schema — every tenant's rows live in
// the same tables, separated only by a workspaceId column. This test proves
// that separation actually holds: that no repository function lets Workspace
// A's context read or reach Workspace B's data, no matter how it's asked.
//
// This hits the real Neon database — it's an integration test, not a unit
// test (CONCEPTS.md §11.1). We create two fully independent tenants, run
// every repository function against both, and assert the boundary never
// leaks in either direction.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import type { TenantContext } from "../src/lib/tenant-context.js";
import * as boardRepo from "../src/repositories/board.repo.js";
import * as listRepo from "../src/repositories/list.repo.js";
import * as cardRepo from "../src/repositories/card.repo.js";

// Unique suffix per run so repeated test runs never collide on the
// Workspace.slug unique constraint.
const runId = Date.now().toString(36);

let ctxA: TenantContext;
let ctxB: TenantContext;
let boardA: { id: string };
let boardB: { id: string };
let listA: { id: string };
let listB: { id: string };
let cardA: { id: string };
let actorIds: string[] = [];

beforeAll(async () => {
  // --- Tenant A -------------------------------------------------------
  const actorA = await prisma.actor.create({
    data: { type: "HUMAN", displayName: "Tenant A User" },
  });
  const userA = await prisma.user.create({
    data: {
      actorId: actorA.id,
      email: `a-${runId}@test.dev`,
      hashedPassword: "x",
      name: "Tenant A User",
    },
  });
  const workspaceA = await prisma.workspace.create({
    data: {
      name: "Tenant A",
      slug: `tenant-a-${runId}`,
      members: { create: { actorId: actorA.id, role: "OWNER" } },
    },
  });
  ctxA = { workspaceId: workspaceA.id, actorId: actorA.id };

  boardA = await boardRepo.createBoard(ctxA, "A's Board");
  listA = await listRepo.createList(ctxA, boardA.id, "A's List", 1.0);
  cardA = await cardRepo.createCard(ctxA, listA.id, "A's Card", 1.0);

  // --- Tenant B — structurally identical, fully separate --------------
  const actorB = await prisma.actor.create({
    data: { type: "HUMAN", displayName: "Tenant B User" },
  });
  const userB = await prisma.user.create({
    data: {
      actorId: actorB.id,
      email: `b-${runId}@test.dev`,
      hashedPassword: "x",
      name: "Tenant B User",
    },
  });
  const workspaceB = await prisma.workspace.create({
    data: {
      name: "Tenant B",
      slug: `tenant-b-${runId}`,
      members: { create: { actorId: actorB.id, role: "OWNER" } },
    },
  });
  ctxB = { workspaceId: workspaceB.id, actorId: actorB.id };
  actorIds = [actorA.id, actorB.id];

  boardB = await boardRepo.createBoard(ctxB, "B's Board");
  listB = await listRepo.createList(ctxB, boardB.id, "B's List", 1.0);
  await cardRepo.createCard(ctxB, listB.id, "B's Card", 1.0);
});

afterAll(async () => {
  // Deleting the workspaces cascades to their boards/lists/cards/members
  // (onDelete: Cascade on every workspace relation — see schema.prisma).
  await prisma.workspace.deleteMany({ where: { slug: { contains: runId } } });
  // Actor is the parent of User — deleting a User leaves its Actor behind, so
  // delete the actors themselves (cascades to their User rows).
  await prisma.actor.deleteMany({ where: { id: { in: actorIds } } });
});

describe("tenant isolation", () => {
  it("listBoards only returns the calling tenant's boards", async () => {
    const boards = await boardRepo.listBoards(ctxA);
    const ids = boards.map((b) => b.id);

    expect(ids).toContain(boardA.id); // sanity check: A's own data IS there
    expect(ids).not.toContain(boardB.id); // the actual isolation claim
  });

  it("getBoardById cannot fetch another tenant's board by ID", async () => {
    // ctxA asking for boardB's real ID — this is the IDOR scenario from
    // CONCEPTS.md §5.7. It must come back null, not the board.
    const result = await boardRepo.getBoardById(ctxA, boardB.id);
    expect(result).toBeNull();
  });

  it("getBoardById still finds a board that legitimately belongs to the tenant", async () => {
    // Paired with the test above on purpose: proves getBoardById isn't
    // just broken and returning null for everything.
    const result = await boardRepo.getBoardById(ctxA, boardA.id);
    expect(result?.id).toBe(boardA.id);
  });

  it("listByBoardId returns nothing when given another tenant's board ID", async () => {
    const lists = await listRepo.listByBoardId(ctxA, boardB.id);
    expect(lists).toHaveLength(0);
  });

  it("listByListId returns nothing when given another tenant's list ID", async () => {
    const cards = await cardRepo.listByListId(ctxA, listB.id);
    expect(cards).toHaveLength(0);
  });

  // A cross-tenant WRITE, not just a read: the target listId comes from the
  // request body, so A must not be able to move its own card into B's list —
  // which would make A's card appear on B's board.
  it("moveCard cannot move a card into another tenant's list", async () => {
    const result = await cardRepo.moveCard(ctxA, cardA.id, listB.id, 5.0);
    expect(result.count).toBe(0);

    const boardBView = await boardRepo.getBoardWithContents(ctxB, boardB.id);
    const cardIdsOnB = boardBView!.lists.flatMap((l) => l.cards.map((c) => c.id));
    expect(cardIdsOnB).not.toContain(cardA.id);
  });
});
