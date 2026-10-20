// Hosted runs: our own worker drives the model, so there's no bearer token.
// Instead the run gets its own short-lived AgentGrant, issued on behalf of the
// human who requested it — the same grant machinery external agents use, so
// both paths end in the same callTool checks (kolumna-architecture.md §6).

import { prisma } from "../lib/prisma.js";
import { AccessEndedError, createGrant } from "./agentGrant.repo.js";
import { parseScopes } from "./scopes.js";
import type { CallContext } from "./tools.js";

// Longer than one model loop should ever take; a stuck run loses its authority.
const RUN_GRANT_TTL_SECONDS = 15 * 60;

export class RunRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunRefusedError";
  }
}

export async function startRun(params: {
  workspaceId: string;
  agentId: string;
  requestedByActorId: string;
  runId: string;
}): Promise<CallContext> {
  // Re-checked at run time, not trusted from enqueue time: the agent may have
  // been suspended while the job sat in the queue (roadmap G6).
  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: params.workspaceId },
  });
  if (!agent) throw new RunRefusedError("Agent not found in this workspace");
  if (agent.status !== "ACTIVE") throw new RunRefusedError(`Agent is ${agent.status}`);

  const scopes = parseScopes(agent.allowedScopes);
  if (scopes.length === 0) throw new RunRefusedError("Agent has no allowed scopes");

  const grant = await createGrant({
    agentId: agent.id,
    workspaceId: agent.workspaceId,
    scopes,
    ttlSeconds: RUN_GRANT_TTL_SECONDS,
    issuedByActorId: params.requestedByActorId,
    kind: "HOSTED_RUN",
  }).then(
    (r) => r.grant,
    (err) => {
      throw err instanceof AccessEndedError ? new RunRefusedError(err.message) : err;
    },
  );

  return {
    grantId: grant.id,
    runId: params.runId,
    onBehalfOfActorId: params.requestedByActorId,
  };
}
