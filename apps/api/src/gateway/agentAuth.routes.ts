// The agent-facing side of the gateway: OAuth 2.1 client-credentials token
// exchange. An agent never logs in as a human does — it presents the
// clientId/clientSecret it got at registration and gets back a short-lived,
// scoped access token bound to a fresh AgentGrant. See
// kolumna-architecture.md §4.1, §6.
//
// Scopes are placeholders for now — there are no MCP tools to gate yet
// (that's Phase 3). Fixing the allowed set here means a client can't just
// invent a scope string; it establishes the shape the real enforcement
// pipeline will check against later.

import { Router } from "express";
import { z } from "zod";
import { findAgentByClientId } from "./agent.repo.js";
import { createGrant } from "./agentGrant.repo.js";
import { hashSecret } from "./credentials.js";
import { ValidationError } from "../lib/errors.js";
import { requireAgentAuth } from "../middleware/requireAgentAuth.js";

const router = Router();

const ALLOWED_SCOPES = ["board:read", "card:read", "card:write"] as const;
const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour
const MAX_TTL_SECONDS = 60 * 60 * 24; // 24 hours — no sprint/project to tie expiry to yet

const tokenRequestSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.array(z.enum(ALLOWED_SCOPES)).min(1),
  ttlSeconds: z.number().int().positive().max(MAX_TTL_SECONDS).optional(),
});

router.post("/agent-auth/token", async (req, res, next) => {
  try {
    const parsed = tokenRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { clientId, clientSecret, scopes, ttlSeconds } = parsed.data;

    const agent = await findAgentByClientId(clientId);
    // Same shape of error for "no such client" and "wrong secret" — don't
    // let the response leak which one it was (CONCEPTS.md §5.7-adjacent).
    if (!agent || agent.hashedClientSecret !== hashSecret(clientSecret)) {
      return res.status(401).json({ error: "Invalid client credentials" });
    }
    if (agent.status !== "ACTIVE") {
      return res.status(403).json({ error: "Agent is not active" });
    }

    const { grant, token } = await createGrant({
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      scopes,
      ttlSeconds: ttlSeconds ?? DEFAULT_TTL_SECONDS,
      issuedByActorId: agent.ownerActorId,
    });

    res.status(201).json({
      accessToken: token,
      tokenType: "Bearer",
      scopes: grant.scopes,
      expiresAt: grant.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// Proves the token actually works end-to-end — the agent's version of
// GET /auth/me. Also the first real consumer of requireAgentAuth.
router.get("/agent-auth/me", requireAgentAuth, async (req, res) => {
  const { agent } = req.agentGrant!;
  res.json({
    agentId: agent.id,
    displayName: agent.actor.displayName,
    workspaceId: agent.workspaceId,
    scopes: req.agentGrant!.scopes,
    expiresAt: req.agentGrant!.expiresAt,
  });
});

export default router;
