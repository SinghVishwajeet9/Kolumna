// Agent identity: registration and lifecycle. Scoped the same way every
// other tenant-owned table is — TenantContext first, workspaceId in every
// WHERE — see lib/tenant-context.ts and ARCHITECTURE.md §6, Decision 1.
//
// An Agent is always backed by its own Actor(AGENT) and a Membership in the
// workspace it's registered in — that's what makes it show up in the member
// list and be assignable to a Card exactly like a human, for free, off the
// work Phase 0 already did.

import { prisma } from "../lib/prisma.js";
import type { TenantContext } from "../lib/tenant-context.js";
import { generateClientId, generateClientSecret, hashSecret } from "./credentials.js";

export async function createAgent(
  ctx: TenantContext,
  params: { displayName: string; modelProvider: string; capabilities: unknown },
) {
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  const hashedClientSecret = hashSecret(clientSecret);

  const agent = await prisma.$transaction(async (tx) => {
    const actor = await tx.actor.create({
      data: { type: "AGENT", displayName: params.displayName },
    });
    const agent = await tx.agent.create({
      data: {
        actorId: actor.id,
        workspaceId: ctx.workspaceId,
        ownerActorId: ctx.actorId,
        modelProvider: params.modelProvider,
        capabilities: params.capabilities as object,
        clientId,
        hashedClientSecret,
      },
    });
    await tx.membership.create({
      data: { actorId: actor.id, workspaceId: ctx.workspaceId, role: "MEMBER" },
    });
    return agent;
  });

  // clientSecret is returned ONLY here — it is never retrievable again.
  return { agent, clientId, clientSecret };
}

export async function listAgents(ctx: TenantContext) {
  return prisma.agent.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { actor: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAgentById(ctx: TenantContext, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId: ctx.workspaceId },
    include: { actor: true },
  });
}

export async function updateAgentStatus(
  ctx: TenantContext,
  agentId: string,
  status: "PROVISIONED" | "ACTIVE" | "SUSPENDED" | "REVOKED",
) {
  return prisma.agent.updateMany({
    where: { id: agentId, workspaceId: ctx.workspaceId },
    data: { status },
  });
}

// Not tenant-scoped by design: an agent authenticating at the token endpoint
// presents only its clientId/clientSecret, not a workspaceId — the
// workspace is recovered FROM the agent record itself once found.
export async function findAgentByClientId(clientId: string) {
  return prisma.agent.findUnique({ where: { clientId } });
}
