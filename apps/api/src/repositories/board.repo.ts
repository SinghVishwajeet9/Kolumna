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
  // Notice: filtered by BOTH id and workspaceId, not just id.
  // If we filtered by id alone, any authenticated user who guessed or was
  // handed a board's ID from another workspace could read it — that's an
  // IDOR (CONCEPTS.md §5.7). Scoping by workspaceId closes it: a board
  // that exists but belongs to a different tenant looks identical, from
  // the caller's side, to a board that doesn't exist at all. Both return
  // null here — the route layer turns that into a 404.
  return prisma.board.findFirst({
    where: { id: boardId, workspaceId: ctx.workspaceId },
  });
}

export async function createBoard(ctx: TenantContext, title: string) {
  return prisma.board.create({
    data: { title, workspaceId: ctx.workspaceId },
  });
}
