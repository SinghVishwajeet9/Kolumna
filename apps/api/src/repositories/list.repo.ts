import { prisma } from "../lib/prisma.js";
import type { TenantContext } from "../lib/tenant-context.js";

export async function listByBoardId(ctx: TenantContext, boardId: string) {
  return prisma.list.findMany({
    where: { boardId, workspaceId: ctx.workspaceId },
    orderBy: { rank: "asc" },
  });
}

export async function createList(
  ctx: TenantContext,
  boardId: string,
  title: string,
  rank: number,
) {
  return prisma.list.create({
    data: { title, rank, boardId, workspaceId: ctx.workspaceId },
  });
}

export async function updateList(ctx: TenantContext, listId: string, title: string) {
  return prisma.list.updateMany({
    where: { id: listId, workspaceId: ctx.workspaceId },
    data: { title },
  });
}

export async function deleteList(ctx: TenantContext, listId: string) {
  // Cascade in schema.prisma handles deleting the list's cards automatically.
  return prisma.list.deleteMany({
    where: { id: listId, workspaceId: ctx.workspaceId },
  });
}

export async function findListAnyWorkspace(userId: string, listId: string) {
  return prisma.list.findFirst({
    where: {
      id: listId,
      workspace: { members: { some: { userId } } },
    },
  });
}

export async function getMaxRank(ctx: TenantContext, boardId: string): Promise<number> {
  const top = await prisma.list.findFirst({
    where: { boardId, workspaceId: ctx.workspaceId },
    orderBy: { rank: "desc" },
  });
  return top ? top.rank + 1 : 1;
}
