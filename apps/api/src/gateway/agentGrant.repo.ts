// Issued access tokens (AgentGrant). One row per token, hashed at rest, same
// pattern as lib/session.ts. This is the "ephemeral agent, permanent
// credential" fix: every grant carries its own expiresAt, set at issuance —
// there's no such thing as a token that just lives forever by default.

import { prisma } from "../lib/prisma.js";
import { generateAccessToken, hashSecret } from "./credentials.js";
import type { AgentGrantKind } from "../generated/prisma/enums.js";

// Thrown when an agent's engagement is over (G14). Every way of getting a
// grant (MCP connect, the token endpoint, hosted runs) goes through
// createGrant, so this one check covers them all.
export class AccessEndedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessEndedError";
  }
}

/** When this agent's access ends, or null if it has no end. Already in the
 * past = access is over. */
export function accessEnd(agent: {
  accessUntil: Date | null;
  accessSprint: { name: string; status: string; completedAt: Date | null } | null;
}): { at: Date; reason: string } | null {
  const ends: { at: Date; reason: string }[] = [];
  if (agent.accessUntil) ends.push({ at: agent.accessUntil, reason: `access ended ${agent.accessUntil.toISOString()}` });
  if (agent.accessSprint?.status === "COMPLETED") {
    ends.push({ at: agent.accessSprint.completedAt ?? new Date(0), reason: `${agent.accessSprint.name} is completed` });
  }
  return ends.sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null;
}

export async function createGrant(params: {
  agentId: string;
  workspaceId: string;
  scopes: string[];
  ttlSeconds: number;
  issuedByActorId: string;
  kind?: AgentGrantKind;
}) {
  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: params.agentId },
    select: { accessUntil: true, accessSprint: { select: { name: true, status: true, completedAt: true } } },
  });
  const end = accessEnd(agent);
  if (end && end.at.getTime() <= Date.now()) {
    throw new AccessEndedError(`Agent access has ended: ${end.reason}`);
  }

  const token = generateAccessToken();
  const tokenHash = hashSecret(token);
  // A grant never outlives the engagement it was issued under.
  const requested = Date.now() + params.ttlSeconds * 1000;
  const expiresAt = new Date(end ? Math.min(requested, end.at.getTime()) : requested);

  const grant = await prisma.agentGrant.create({
    data: {
      kind: params.kind ?? "CLIENT_CREDENTIALS",
      agentId: params.agentId,
      workspaceId: params.workspaceId,
      scopes: params.scopes,
      tokenHash,
      expiresAt,
      issuedByActorId: params.issuedByActorId,
    },
  });

  // The raw token is returned ONLY here — it is never retrievable again.
  return { grant, token };
}

/** Given a raw bearer token, returns the still-valid grant + its agent, or
 * null if the token is unknown, expired, or explicitly revoked. */
export async function findValidGrantByToken(token: string) {
  const tokenHash = hashSecret(token);

  const grant = await prisma.agentGrant.findUnique({
    where: { tokenHash },
    include: { agent: { include: { actor: true } } },
  });

  if (!grant) return null;
  if (grant.revokedAt) return null;
  if (Date.now() >= grant.expiresAt.getTime()) return null;

  return grant;
}

/** Revoking an Agent (or suspending it) kills every grant it currently
 * holds — access dies immediately, not just at next natural expiry. */
export async function revokeAllGrantsForAgent(agentId: string) {
  return prisma.agentGrant.updateMany({
    where: { agentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
