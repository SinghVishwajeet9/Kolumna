import { prisma } from "../lib/prisma.js";

export async function listWorkspacesForUser(userId: string) {
  return prisma.workspace.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
  });
}

export async function createWorkspace(userId: string, name: string, slug: string) {
  return prisma.workspace.create({
    data: {
      name,
      slug,
      members: {
        create: { userId, role: "OWNER" },
      },
    },
  });
}
