import { prisma } from "../lib/prisma.js";
import type { TenantContext } from "../lib/tenant-context.js";

export async function listByListId(ctx: TenantContext, listId: string) {
  return prisma.card.findMany({
    where: { listId, workspaceId: ctx.workspaceId },
    orderBy: { rank: "asc" },
  });
}

export async function createCard(
  ctx: TenantContext,
  listId: string,
  title: string,
  rank: number,
) {
  return prisma.card.create({
    data: { title, rank, listId, workspaceId: ctx.workspaceId },
  });
}

export async function findCardAnyWorkspace(actorId: string, cardId: string) {
  return prisma.card.findFirst({
    where: { id: cardId, workspace: { members: { some: { actorId } } } },
  });
}

export async function updateCard(
  ctx: TenantContext,
  cardId: string,
  data: {
    title?: string;
    description?: string;
    dueDate?: Date | null;
    assigneeId?: string | null;
  },
) {
  return prisma.card.updateMany({
    where: { id: cardId, workspaceId: ctx.workspaceId },
    data,
  });
}

export async function deleteCard(ctx: TenantContext, cardId: string) {
  return prisma.card.deleteMany({
    where: { id: cardId, workspaceId: ctx.workspaceId },
  });
}

export async function getMaxRank(ctx: TenantContext, listId: string): Promise<number> {
  const top = await prisma.card.findFirst({
    where: { listId, workspaceId: ctx.workspaceId },
    orderBy: { rank: "desc" },
  });
  return top ? top.rank + 1 : 1;
}

// Server-side rank lookup for a move: given the IDs of the cards that
// SHOULD end up immediately before/after (sent by the client), fetch their
// current ranks. Either can be missing (dropped at start/end of the list).
export async function getNeighborRanks(
  ctx: TenantContext,
  beforeId: string | null,
  afterId: string | null,
) {
  const [before, after] = await Promise.all([
    beforeId
      ? prisma.card.findFirst({ where: { id: beforeId, workspaceId: ctx.workspaceId } })
      : null,
    afterId
      ? prisma.card.findFirst({ where: { id: afterId, workspaceId: ctx.workspaceId } })
      : null,
  ]);
  return { beforeRank: before?.rank ?? null, afterRank: after?.rank ?? null };
}

export async function moveCard(
  ctx: TenantContext,
  cardId: string,
  listId: string,
  rank: number,
) {
  return prisma.card.updateMany({
    where: { id: cardId, workspaceId: ctx.workspaceId },
    data: { listId, rank },
  });
}
