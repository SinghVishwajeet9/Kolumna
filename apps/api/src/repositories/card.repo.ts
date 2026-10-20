import { prisma } from "../lib/prisma.js";
import type { TenantContext } from "../lib/tenant-context.js";
import { allocateCardNumber } from "../lib/keys.js";
import { AUDIT_TX_OPTIONS } from "../lib/audit.js";

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
  sprintId?: string | null, // undefined = "whatever sprint is active"
) {
  return prisma.$transaction(async (tx) => {
    // The list decides the board — and the composite FK guarantees the pair
    // is consistent, so a card can't be created "on" a board its list isn't on.
    const list = await tx.list.findFirstOrThrow({
      where: { id: listId, workspaceId: ctx.workspaceId },
      select: { boardId: true },
    });
    const number = await allocateCardNumber(tx, list.boardId);
    // Created on the board while a sprint is running → it's part of that
    // sprint (it would otherwise vanish from the sprint-only board view).
    const active =
      sprintId === undefined
        ? await tx.sprint.findFirst({ where: { boardId: list.boardId, status: "ACTIVE" }, select: { id: true } })
        : null;
    return tx.card.create({
      data: {
        title,
        rank,
        listId,
        boardId: list.boardId,
        number,
        workspaceId: ctx.workspaceId,
        sprintId: sprintId === undefined ? (active?.id ?? null) : sprintId,
      },
    });
  }, AUDIT_TX_OPTIONS); // concurrent creates queue on the board row lock
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
    priority?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    storyPoints?: number | null;
    epicId?: string | null;
    sprintId?: string | null;
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
  // The target listId comes from the client. Filtering the CARD by
  // workspaceId isn't enough — without this check a card could be moved into
  // another tenant's list and show up on their board. The list must also be
  // on the card's OWN board: keys like PRM-3 belong to one board, and the
  // composite FK would reject a cross-board move anyway (as a 500, not a 404).
  const card = await prisma.card.findFirst({
    where: { id: cardId, workspaceId: ctx.workspaceId },
    select: { boardId: true },
  });
  if (!card) return { count: 0 };
  const targetList = await prisma.list.findFirst({
    where: { id: listId, workspaceId: ctx.workspaceId, boardId: card.boardId },
  });
  if (!targetList) return { count: 0 };

  return prisma.card.updateMany({
    where: { id: cardId, workspaceId: ctx.workspaceId },
    data: { listId, rank },
  });
}
