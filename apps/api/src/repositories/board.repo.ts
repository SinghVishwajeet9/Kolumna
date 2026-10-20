// The ONLY file allowed to run Prisma queries against Board rows.
// Every function here takes `ctx: TenantContext` as its first parameter and
// filters by ctx.workspaceId — that's what makes cross-tenant leaks
// structurally impossible instead of just "something we try to remember."
// See ARCHITECTURE.md §4 and §6, Decision 1.

import { prisma } from "../lib/prisma.js";
import type { TenantContext } from "../lib/tenant-context.js";
import { uniqueBoardKey } from "../lib/keys.js";
import { AUDIT_TX_OPTIONS } from "../lib/audit.js";

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
        include: {
          cards: {
            orderBy: { rank: "asc" },
            // What a card face shows: who has it (and whether that's an
            // agent), checklist progress, and how much discussion.
            include: {
              assignee: { select: { id: true, displayName: true, type: true } },
              checklistItems: { select: { done: true } },
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  });
}

// The board page. With an ACTIVE sprint it shows only that sprint's cards
// (Jira Scrum); everything else waits on the backlog page. Without one, it
// shows every card, as before.
export async function getBoardView(actorId: string, boardId: string) {
  const access = await prisma.board.findFirst({
    where: { id: boardId, workspace: { members: { some: { actorId } } } },
    select: { id: true },
  });
  if (!access) return null;

  const activeSprint = await prisma.sprint.findFirst({
    where: { boardId, status: "ACTIVE" },
    select: { id: true, name: true, goal: true, startsAt: true, endsAt: true },
  });

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { rank: "asc" },
        include: {
          cards: {
            where: activeSprint ? { sprintId: activeSprint.id } : {},
            orderBy: { rank: "asc" },
            include: {
              assignee: { select: { id: true, displayName: true, type: true } },
              checklistItems: { select: { done: true } },
              epic: { select: { id: true, title: true, color: true } },
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  });
  return board && { ...board, activeSprint };
}

export async function createBoard(ctx: TenantContext, title: string) {
  return prisma.$transaction(async (tx) =>
    tx.board.create({
      data: { title, workspaceId: ctx.workspaceId, key: await uniqueBoardKey(tx, ctx.workspaceId, title) },
    }),
    AUDIT_TX_OPTIONS,
  );
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
