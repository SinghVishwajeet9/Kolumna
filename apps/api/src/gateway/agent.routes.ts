// Human-facing agent lifecycle: register / list / activate / suspend /
// revoke. All require a logged-in human who's a member of the workspace —
// same requireAuth + requireWorkspaceMember pattern as boards/lists/cards.
// Listing is open to every member; every change (register, activate,
// suspend, revoke, rotate, access, autonomy) is OWNER/ADMIN only (G11).

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { requireWorkspaceAdmin } from "../middleware/requireWorkspaceAdmin.js";
import * as agentRepo from "./agent.repo.js";
import { accessEnd, revokeAllGrantsForAgent } from "./agentGrant.repo.js";
import { appendAuditEntry, writeAuditEntry, AUDIT_TX_OPTIONS } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { scopeListSchema } from "./scopes.js";
import { generateClientSecret, hashSecret } from "./credentials.js";

const router = Router();

const registerSchema = z.object({
  displayName: z.string().min(1),
  modelProvider: z.string().min(1),
  capabilities: z.unknown().optional().default({}),
  // The ceiling. The registering human decides what this agent may EVER be
  // granted; the agent can't widen it at token time.
  allowedScopes: scopeListSchema,
  // Phase 4: how much it may do without a human. Defaults to the cautious
  // middle (ACT_WITH_APPROVAL) — trust is earned, then granted.
  autonomyLevel: z.enum(["SUGGEST_ONLY", "ACT_WITH_APPROVAL", "ACT_AUTONOMOUS"]).optional(),
});

router.post(
  "/workspaces/:workspaceId/agents",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.message);

      // createAgent writes the AGENT.REGISTER audit entry in its own transaction.
      const { agent, clientId, clientSecret } = await agentRepo.createAgent(req.ctx!, parsed.data);

      // clientSecret is shown exactly once, here — the caller must store it
      // now. The server never has it in recoverable form again.
      res.status(201).json({
        agent: {
          id: agent.id,
          actorId: agent.actorId,
          status: agent.status,
          modelProvider: agent.modelProvider,
          allowedScopes: agent.allowedScopes,
          autonomyLevel: agent.autonomyLevel,
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
      const actorIds = agents.map((a) => a.actorId);
      // "Is it actually doing anything?" — last audited action and open cards
      // per agent, in two grouped queries rather than one per agent.
      const [lastSeen, cardCounts] = await Promise.all([
        prisma.auditEntry.groupBy({
          by: ["actorId"],
          where: { workspaceId: req.ctx!.workspaceId, actorId: { in: actorIds } },
          _max: { createdAt: true },
        }),
        prisma.card.groupBy({
          by: ["assigneeId"],
          where: { workspaceId: req.ctx!.workspaceId, assigneeId: { in: actorIds } },
          _count: { _all: true },
        }),
      ]);
      res.json(
        agents.map((a) => ({
          id: a.id,
          actorId: a.actorId, // this is what Card.assigneeId expects
          displayName: a.actor.displayName,
          modelProvider: a.modelProvider,
          client: (a.capabilities as { client?: string } | null)?.client ?? null,
          allowedScopes: a.allowedScopes,
          status: a.status,
          clientId: a.clientId,
          createdAt: a.createdAt,
          lastActiveAt: lastSeen.find((l) => l.actorId === a.actorId)?._max.createdAt ?? null,
          assignedCards: cardCounts.find((c) => c.assigneeId === a.actorId)?._count._all ?? 0,
          accessUntil: a.accessUntil,
          accessSprint: a.accessSprint ? { id: a.accessSprint.id, name: a.accessSprint.name, status: a.accessSprint.status } : null,
          autonomyLevel: a.autonomyLevel,
          confidenceThreshold: a.confidenceThreshold,
          boardPolicies: a.autonomyPolicies.map((p) => ({
            boardId: p.boardId,
            level: p.level,
            confidenceThreshold: p.confidenceThreshold,
          })),
          accessEnded: (() => {
            const end = accessEnd(a);
            return end !== null && end.at.getTime() <= Date.now();
          })(),
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
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");
      if (agent.status === "REVOKED") {
        throw new ValidationError("A revoked agent cannot be reactivated");
      }

      await agentRepo.updateAgentStatus(req.ctx!, agent.id, "ACTIVE");
      await writeAuditEntry({
        workspaceId: req.ctx!.workspaceId,
        actorId: req.ctx!.actorId,
        action: "AGENT.ACTIVATE",
        targetType: "Agent",
        targetId: agent.id,
        result: "SUCCESS",
      });
      res.json({ id: agent.id, status: "ACTIVE" });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/workspaces/:workspaceId/agents/:agentId/suspend",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");
      if (agent.status === "REVOKED") {
        throw new ValidationError("A revoked agent cannot be suspended");
      }

      await agentRepo.updateAgentStatus(req.ctx!, agent.id, "SUSPENDED");
      await revokeAllGrantsForAgent(agent.id); // suspension kills live access immediately
      const rejected = await rejectPendingProposals(agent.actorId, req.ctx!.actorId);
      await writeAuditEntry({
        workspaceId: req.ctx!.workspaceId,
        actorId: req.ctx!.actorId,
        action: "AGENT.SUSPEND",
        targetType: "Agent",
        targetId: agent.id,
        result: "SUCCESS",
        resource: `${rejected} pending proposals rejected`,
      });
      res.json({ id: agent.id, status: "SUSPENDED" });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/workspaces/:workspaceId/agents/:agentId/revoke",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");

      await agentRepo.updateAgentStatus(req.ctx!, agent.id, "REVOKED");
      await revokeAllGrantsForAgent(agent.id); // terminal — no path back from here
      const rejected = await rejectPendingProposals(agent.actorId, req.ctx!.actorId);
      await writeAuditEntry({
        workspaceId: req.ctx!.workspaceId,
        actorId: req.ctx!.actorId,
        action: "AGENT.REVOKE",
        targetType: "Agent",
        targetId: agent.id,
        result: "SUCCESS",
        resource: `${rejected} pending proposals rejected`,
      });
      res.json({ id: agent.id, status: "REVOKED" });
    } catch (err) {
      next(err);
    }
  },
);

// Phase 4 — how much this agent may do without a human. The default level
// applies on every board; per-board policies override it.
const levelSchema = z.enum(["SUGGEST_ONLY", "ACT_WITH_APPROVAL", "ACT_AUTONOMOUS"]);
const thresholdSchema = z.number().min(0).max(1);

router.patch(
  "/workspaces/:workspaceId/agents/:agentId/autonomy",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const parsed = z
        .object({ level: levelSchema.optional(), confidenceThreshold: thresholdSchema.optional() })
        .safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.message);
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");

      const updated = await prisma.$transaction(async (tx) => {
        const a = await tx.agent.update({
          where: { id: agent.id },
          data: {
            ...(parsed.data.level ? { autonomyLevel: parsed.data.level } : {}),
            ...(parsed.data.confidenceThreshold !== undefined
              ? { confidenceThreshold: parsed.data.confidenceThreshold }
              : {}),
          },
        });
        await appendAuditEntry(tx, {
          workspaceId: req.ctx!.workspaceId,
          actorId: req.ctx!.actorId,
          action: "AGENT.SET_AUTONOMY",
          targetType: "Agent",
          targetId: agent.id,
          result: "SUCCESS",
          resource: `default: ${agent.autonomyLevel} -> ${a.autonomyLevel}, threshold ${agent.confidenceThreshold} -> ${a.confidenceThreshold}`,
        });
        return a;
      }, AUDIT_TX_OPTIONS);
      res.json({ id: updated.id, autonomyLevel: updated.autonomyLevel, confidenceThreshold: updated.confidenceThreshold });
    } catch (err) {
      next(err);
    }
  },
);

// level: null removes the board's override (back to the agent's default).
router.put(
  "/workspaces/:workspaceId/agents/:agentId/autonomy/boards/:boardId",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const parsed = z
        .object({ level: levelSchema.nullable(), confidenceThreshold: thresholdSchema.nullable().optional() })
        .safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.message);
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");
      const board = await prisma.board.findFirst({
        where: { id: req.params.boardId!, workspaceId: req.ctx!.workspaceId },
      });
      if (!board) throw new NotFoundError("Board not found");

      const { level, confidenceThreshold } = parsed.data;
      await prisma.$transaction(async (tx) => {
        if (level === null) {
          await tx.autonomyPolicy.deleteMany({ where: { agentId: agent.id, boardId: board.id } });
        } else {
          await tx.autonomyPolicy.upsert({
            where: { agentId_boardId: { agentId: agent.id, boardId: board.id } },
            create: {
              workspaceId: req.ctx!.workspaceId,
              agentId: agent.id,
              boardId: board.id,
              level,
              confidenceThreshold: confidenceThreshold ?? null,
            },
            update: { level, confidenceThreshold: confidenceThreshold ?? null },
          });
        }
        await appendAuditEntry(tx, {
          workspaceId: req.ctx!.workspaceId,
          actorId: req.ctx!.actorId,
          action: "AGENT.SET_AUTONOMY",
          targetType: "Agent",
          targetId: agent.id,
          result: "SUCCESS",
          resource: `${board.title}: ${level ?? "default"}${confidenceThreshold != null ? ` @ ${confidenceThreshold}` : ""}`,
        });
      }, AUDIT_TX_OPTIONS);
      res.json({ agentId: agent.id, boardId: board.id, level, confidenceThreshold: confidenceThreshold ?? null });
    } catch (err) {
      next(err);
    }
  },
);

// G14 — when this agent's engagement ends: a date, the end of a sprint, both
// (whichever comes first), or neither (null clears). Shortening it caps the
// agent's live grants straight away rather than at their natural expiry.
const accessSchema = z.object({
  accessUntil: z.string().datetime().nullable().optional(),
  accessSprintId: z.string().nullable().optional(),
});

router.patch(
  "/workspaces/:workspaceId/agents/:agentId/access",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const parsed = accessSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.message);
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");

      const { accessUntil, accessSprintId } = parsed.data;
      if (accessSprintId) {
        const sprint = await prisma.sprint.findFirst({
          where: { id: accessSprintId, workspaceId: req.ctx!.workspaceId },
        });
        if (!sprint) throw new ValidationError("Sprint not found in this workspace");
        if (sprint.status === "COMPLETED") throw new ValidationError("That sprint is already completed");
      }

      const updated = await prisma.$transaction(async (tx) => {
        const a = await tx.agent.update({
          where: { id: agent.id },
          data: {
            ...(accessUntil !== undefined ? { accessUntil: accessUntil ? new Date(accessUntil) : null } : {}),
            ...(accessSprintId !== undefined ? { accessSprintId } : {}),
          },
          include: { accessSprint: { select: { id: true, name: true, status: true, completedAt: true } } },
        });
        const end = accessEnd(a);
        if (end) {
          await tx.agentGrant.updateMany({
            where: { agentId: a.id, revokedAt: null, expiresAt: { gt: end.at } },
            data: { expiresAt: end.at },
          });
        }
        await appendAuditEntry(tx, {
          workspaceId: req.ctx!.workspaceId,
          actorId: req.ctx!.actorId,
          action: "AGENT.SET_ACCESS",
          targetType: "Agent",
          targetId: a.id,
          result: "SUCCESS",
          resource: [
            a.accessUntil ? `until ${a.accessUntil.toISOString()}` : null,
            a.accessSprint ? `until ${a.accessSprint.name} completes` : null,
          ].filter(Boolean).join("; ") || "no end",
        });
        return a;
      }, AUDIT_TX_OPTIONS);

      res.json({
        id: updated.id,
        accessUntil: updated.accessUntil,
        accessSprint: updated.accessSprint
          ? { id: updated.accessSprint.id, name: updated.accessSprint.name, status: updated.accessSprint.status }
          : null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// The secret now lives in client config files (Claude Code, Codex…), so it
// must be replaceable if one leaks. Rotating kills every live grant too: the
// old secret, and any session it opened, stop working on the next call.
router.post(
  "/workspaces/:workspaceId/agents/:agentId/rotate-secret",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const agent = await agentRepo.getAgentById(req.ctx!, req.params.agentId!);
      if (!agent) throw new NotFoundError("Agent not found");
      if (agent.status === "REVOKED") {
        throw new ValidationError("A revoked agent's secret can't be rotated");
      }

      const clientSecret = generateClientSecret();
      await prisma.$transaction(async (tx) => {
        await tx.agent.update({
          where: { id: agent.id },
          data: { hashedClientSecret: hashSecret(clientSecret) },
        });
        await tx.agentGrant.updateMany({
          where: { agentId: agent.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await appendAuditEntry(tx, {
          workspaceId: req.ctx!.workspaceId,
          actorId: req.ctx!.actorId,
          action: "AGENT.ROTATE_SECRET",
          targetType: "Agent",
          targetId: agent.id,
          result: "SUCCESS",
        });
      }, AUDIT_TX_OPTIONS);

      // Shown exactly once, like at registration.
      res.json({ id: agent.id, clientId: agent.clientId, clientSecret });
    } catch (err) {
      next(err);
    }
  },
);

// An agent that's been cut off shouldn't leave plans waiting for approval —
// approving one later would act on its behalf after its authority ended.
async function rejectPendingProposals(agentActorId: string, reviewerActorId: string) {
  const { count } = await prisma.subtaskProposal.updateMany({
    where: { proposedByActorId: agentActorId, status: "PENDING" },
    data: { status: "REJECTED", reviewedByActorId: reviewerActorId, reviewedAt: new Date() },
  });
  return count;
}

export default router;
