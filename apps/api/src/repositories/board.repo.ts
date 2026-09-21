// The ONLY file allowed to run Prisma queries against Board rows.
// Every function here takes `ctx: TenantContext` as its first parameter and
// filters by ctx.workspaceId — that's what makes cross-tenant leaks
// structurally impossible instead of just "something we try to remember."
// See ARCHITECTURE.md §4 and §6, Decision 1.

import { prisma } from "../lib/prisma.js";
import type { TenantContext } from "../lib/tenant-context.js";

export async function listBoards(ctx: TenantContext) {
  return prisma.board.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getBoardById(ctx: TenantContext, boardId: string) {
  // id + workspaceId together, not id alone — see CONCEPTS.md §5.7 (IDOR).
  return prisma.board.findFirst({
    where: { id: boardId, workspaceId: ctx.workspaceId },
  });
}

// Fully hydrated: board + its lists + each list's cards, ONE query via
// `include`, ordered by rank (drag order), not createdAt. Doing this as a
// loop instead (fetch lists, then loop fetching cards per list) is the
// classic N+1 problem — CONCEPTS.md §3.13.
export async function getBoardWithContents(ctx: TenantContext, boardId: string) {
  return prisma.board.findFirst({
    where: { id: boardId, workspaceId: ctx.workspaceId },
    include: {
      lists: {
        orderBy: { rank: "asc" },
        include: {
          cards: { orderBy: { rank: "asc" } },
        },
      },
    },
  });
}

// For routes NOT nested under /workspaces/:workspaceId (e.g. /boards/:id),
// we don't know the workspace upfront. Instead of trusting a workspaceId
// from the client, filter through the relation: "only boards belonging to
// a workspace where THIS user is a member." Same tenant-safety guarantee
// as the ctx pattern, just expressed via a relation instead of a known ID.
export async function findBoardAnyWorkspace(actorId: string, boardId: string) {
  return prisma.board.findFirst({
    where: {
      id: boardId,
      workspace: { members: { some: { actorId } } },
    },
    include: {
      lists: {
        orderBy: { rank: "asc" },
        include: { cards: { orderBy: { rank: "asc" } } },
      },
    },
  });
}

export async function createBoard(ctx: TenantContext, title: string) {
  return prisma.board.create({
    data: { title, workspaceId: ctx.workspaceId },
  });
}

export async function updateBoard(ctx: TenantContext, boardId: string, title: string) {
  // updateMany, not update — update() throws if the row isn't found, and
  // findFirst-style filtering (id + workspaceId) isn't available on the
  // unique-lookup update(). updateMany lets us filter on both and just
  // reports how many rows changed (0 = not found or not yours).
  return prisma.board.updateMany({
    where: { id: boardId, workspaceId: ctx.workspaceId },
    data: { title },
  });
}

export async function deleteBoard(ctx: TenantContext, boardId: string) {
  return prisma.board.deleteMany({
    where: { id: boardId, workspaceId: ctx.workspaceId },
  });
}
