// Human-facing agent lifecycle: register / list / activate / suspend /
// revoke. All require a logged-in human who's a member of the workspace —
// same requireAuth + requireWorkspaceMember pattern as boards/lists/cards.
// Managing agents isn't restricted to OWNER/ADMIN yet — any member can
// register/manage one; role-scoping this is deferred, see PHASE_1.md.

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import * as agentRepo from "./agent.repo.js";
import { revokeAllGrantsForAgent } from "./agentGrant.repo.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const router = Router();

const registerSchema = z.object({
  displayName: z.string().min(1),
  modelProvider: z.string().min(1),
  capabilities: z.unknown().optional().default({}),
});

router.post(
  "/workspaces/:workspaceId/agents",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.message);

      const { agent, clientId, clientSecret } = await agentRepo.createAgent(req.ctx!, parsed.data);

      // clientSecret is shown exactly once, here — the caller must store it
      // now. The server never has it in recoverable form again.
      res.status(201).json({
        agent: {
          id: agent.id,
          actorId: agent.actorId,
          status: agent.status,
          modelProvider: agent.modelProvider,
        },
        clientId,
        clientSecret,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/workspaces/:workspaceId/agents",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const agents = await agentRepo.listAgents(req.ctx!);
      res.json(
        agents.map((a) => ({
          id: a.id,
          actorId: a.actorId, // this is what Card.assigneeId expects
          displayName: a.actor.displayName,
          modelProvider: a.modelProvider,
          status: a.status,
          clientId: a.clientId,
          createdAt: a.createdAt,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

// Explicit human-in-the-loop gate: a newly registered agent is PROVISIONED,
// not ACTIVE — it cannot request a token until a member activates it.
router.patch(
  "/workspaces/:workspaceId/agents/:agentId/activate",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");
      if (agent.status === "REVOKED") {
        throw new ValidationError("A revoked agent cannot be reactivated");
      }

      await agentRepo.updateAgentStatus(req.ctx!, agent.id, "ACTIVE");
      res.json({ id: agent.id, status: "ACTIVE" });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/workspaces/:workspaceId/agents/:agentId/suspend",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");
      if (agent.status === "REVOKED") {
        throw new ValidationError("A revoked agent cannot be suspended");
      }

      await agentRepo.updateAgentStatus(req.ctx!, agent.id, "SUSPENDED");
      await revokeAllGrantsForAgent(agent.id); // suspension kills live access immediately
      res.json({ id: agent.id, status: "SUSPENDED" });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/workspaces/:workspaceId/agents/:agentId/revoke",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");

      await agentRepo.updateAgentStatus(req.ctx!, agent.id, "REVOKED");
      await revokeAllGrantsForAgent(agent.id); // terminal — no path back from here
      res.json({ id: agent.id, status: "REVOKED" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
