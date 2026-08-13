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
