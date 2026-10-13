// Issued access tokens (AgentGrant). One row per token, hashed at rest, same
// pattern as lib/session.ts. This is the "ephemeral agent, permanent
// credential" fix: every grant carries its own expiresAt, set at issuance —
// there's no such thing as a token that just lives forever by default.

import { prisma } from "../lib/prisma.js";
import { generateAccessToken, hashSecret } from "./credentials.js";
import type { AgentGrantKind } from "../generated/prisma/enums.js";

export async function createGrant(params: {
  agentId: string;
  workspaceId: string;
  scopes: string[];
  ttlSeconds: number;
  issuedByActorId: string;
  kind?: AgentGrantKind;
}) {
  const token = generateAccessToken();
  const tokenHash = hashSecret(token);
  const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000);

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
