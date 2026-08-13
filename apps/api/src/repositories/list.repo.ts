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
