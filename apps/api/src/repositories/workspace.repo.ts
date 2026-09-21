import { prisma } from "../lib/prisma.js";

export async function listWorkspacesForActor(actorId: string) {
  return prisma.workspace.findMany({
    where: {
      members: {
        some: { actorId },
      },
    },
  });
}

// Used when assigning a card: the assignee (human or agent) must actually
// belong to the workspace the card lives in — same tenant-safety idea as
// everything else, applied to Actor instead of the card/board/list chain.
export async function isWorkspaceMember(workspaceId: string, actorId: string) {
  const membership = await prisma.membership.findUnique({
    where: { actorId_workspaceId: { actorId, workspaceId } },
  });
  return membership !== null;
}

export async function createWorkspace(actorId: string, name: string, slug: string) {
  return prisma.workspace.create({
    data: {
      name,
      slug,
      members: {
        create: { actorId, role: "OWNER" },
      },
    },
  });
}
