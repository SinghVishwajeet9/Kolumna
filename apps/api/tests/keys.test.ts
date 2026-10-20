// Phase 3.5 guarantees: board keys, race-free card numbers, and the
// database-level tenant/board consistency (roadmap G12) — tested against the
// real database, because two of the three are enforced BY the database.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { boardKeyFromTitle } from "../src/lib/keys.js";
import * as boardRepo from "../src/repositories/board.repo.js";
import * as listRepo from "../src/repositories/list.repo.js";
import * as cardRepo from "../src/repositories/card.repo.js";
import type { TenantContext } from "../src/lib/tenant-context.js";

const tag = Date.now().toString(36);
const actorIds: string[] = [];
const workspaceIds: string[] = [];

async function tenant(name: string): Promise<TenantContext> {
  const actor = await prisma.actor.create({ data: { type: "HUMAN", displayName: `${name} ${tag}` } });
  actorIds.push(actor.id);
  const ws = await prisma.workspace.create({
    data: { name, slug: `keys-${name}-${tag}`, members: { create: { actorId: actor.id, role: "OWNER" } } },
  });
  workspaceIds.push(ws.id);
  return { workspaceId: ws.id, actorId: actor.id };
}

let a: TenantContext;
let b: TenantContext;

beforeAll(async () => {
  a = await tenant("A");
  b = await tenant("B");
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await prisma.actor.deleteMany({ where: { id: { in: actorIds } } });
});

describe("board keys", () => {
  it("derives keys from titles (same rule as the migration backfill)", () => {
    expect(boardKeyFromTitle("Product Road Map")).toBe("PRM");
    expect(boardKeyFromTitle("login bug")).toBe("LB");
    expect(boardKeyFromTitle("roadmap")).toBe("ROA");
    expect(boardKeyFromTitle("Q3 — launch / prep, v2!")).toBe("QLPV");
    expect(boardKeyFromTitle("!!!")).toBe("B");
  });

  it("de-duplicates within a workspace but not across workspaces", async () => {
    const first = await boardRepo.createBoard(a, "Product Road Map");
    const second = await boardRepo.createBoard(a, "Product Road Map");
    const otherTenant = await boardRepo.createBoard(b, "Product Road Map");
    expect(first.key).toBe("PRM");
    expect(second.key).toBe("PRM2");
    expect(otherTenant.key).toBe("PRM");
  });
});

describe("card numbers", () => {
  it("are unique and gap-free even when cards are created concurrently", async () => {
    const board = await boardRepo.createBoard(a, "Race Board");
    const list = await listRepo.createList(a, board.id, "To Do", 1);
    const cards = await Promise.all(
      Array.from({ length: 6 }, (_, i) => cardRepo.createCard(a, list.id, `card ${i}`, i)),
    );
    expect(cards.map((c) => c.number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("tenant + board consistency enforced by the database (G12)", () => {
  // These bypass the repository on purpose: the point is that even buggy
  // app code can't write an inconsistent card — Postgres refuses it.
  it("rejects a card whose list belongs to another workspace", async () => {
    const boardB = await boardRepo.createBoard(b, "B board");
    const listB = await listRepo.createList(b, boardB.id, "To Do", 1);
    const boardA = await boardRepo.createBoard(a, "A board");
    await expect(
      prisma.card.create({
        data: { title: "smuggled", listId: listB.id, boardId: boardA.id, number: 99, workspaceId: a.workspaceId, rank: 1 },
      }),
    ).rejects.toThrow();
  });

  it("rejects a card whose list is on a different board of the same workspace", async () => {
    const board1 = await boardRepo.createBoard(a, "One");
    const board2 = await boardRepo.createBoard(a, "Two");
    const list2 = await listRepo.createList(a, board2.id, "To Do", 1);
    await expect(
      prisma.card.create({
        data: { title: "drifted", listId: list2.id, boardId: board1.id, number: 99, workspaceId: a.workspaceId, rank: 1 },
      }),
    ).rejects.toThrow();
  });

  it("moveCard refuses another board's list cleanly (count 0, not a DB error)", async () => {
    const board1 = await boardRepo.createBoard(a, "Mover One");
    const board2 = await boardRepo.createBoard(a, "Mover Two");
    const list1 = await listRepo.createList(a, board1.id, "To Do", 1);
    const list2 = await listRepo.createList(a, board2.id, "To Do", 1);
    const card = await cardRepo.createCard(a, list1.id, "stay home", 1);
    const result = await cardRepo.moveCard(a, card.id, list2.id, 5);
    expect(result.count).toBe(0);
  });
});
