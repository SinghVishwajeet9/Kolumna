// The human side of "agent proposes, human approves". Cookie-session routes
// only (requireAuth), so an agent — which authenticates with client
// credentials, never a session — can't reach them: an agent can't approve
// its own (or any) proposal.

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { assertWorkspaceAdmin } from "../middleware/requireWorkspaceAdmin.js";
import { appendAuditEntry, AUDIT_TX_OPTIONS } from "../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";

const router = Router();

router.get(
  "/workspaces/:workspaceId/proposals",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const status = z
        .enum(["PENDING", "APPROVED", "REJECTED"])
        .optional()
        .safeParse(req.query.status);
      if (!status.success) throw new ValidationError("status must be PENDING, APPROVED or REJECTED");

      const proposals = await prisma.subtaskProposal.findMany({
        where: { workspaceId: req.ctx!.workspaceId, ...(status.data ? { status: status.data } : {}) },
        include: { card: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json(proposals);
    } catch (err) {
      next(err);
    }
  },
);

async function findReviewableProposal(actorId: string, proposalId: string) {
  const proposal = await prisma.subtaskProposal.findFirst({
    where: { id: proposalId, workspace: { members: { some: { actorId } } } },
  });
  if (!proposal) throw new NotFoundError("Proposal not found");
  await assertWorkspaceAdmin(actorId, proposal.workspaceId); // G11: approving is an admin decision
  return proposal;
}

const subtasksSchema = z.array(z.object({ title: z.string().min(1) }));

router.post("/proposals/:proposalId/approve", requireAuth, async (req, res, next) => {
  try {
    const reviewer = req.user!.actorId;
    const proposal = await findReviewableProposal(reviewer, req.params.proposalId!);
    const subtasks = subtasksSchema.parse(proposal.subtasks);

    const items = await prisma.$transaction(async (tx) => {
      // Conditional update = the "still pending?" check and the state change
      // in one step, so two reviewers clicking at once can't both apply it.
      const flipped = await tx.subtaskProposal.updateMany({
        where: { id: proposal.id, status: "PENDING" },
        data: { status: "APPROVED", reviewedByActorId: reviewer, reviewedAt: new Date() },
      });
      if (flipped.count === 0) throw new ConflictError("Proposal is no longer pending");

      const top = await tx.checklistItem.findFirst({
        where: { cardId: proposal.cardId },
        orderBy: { rank: "desc" },
      });
      let rank = top ? top.rank + 1 : 1;
      const created = [];
      for (const s of subtasks) {
        created.push(
          await tx.checklistItem.create({
            data: {
              workspaceId: proposal.workspaceId,
              cardId: proposal.cardId,
              title: s.title,
              rank: rank++,
              createdByActorId: proposal.proposedByActorId,
              sourceProposalId: proposal.id,
            },
          }),
        );
      }

      await appendAuditEntry(tx, {
        workspaceId: proposal.workspaceId,
        actorId: reviewer,
        action: "PROPOSAL.APPROVE",
        targetType: "Card",
        targetId: proposal.cardId,
        result: "SUCCESS",
        resource: proposal.id,
      });
      return created;
    }, AUDIT_TX_OPTIONS);

    res.json({ proposalId: proposal.id, status: "APPROVED", checklistItems: items });
  } catch (err) {
    next(err);
  }
});

router.post("/proposals/:proposalId/reject", requireAuth, async (req, res, next) => {
  try {
    const reviewer = req.user!.actorId;
    const proposal = await findReviewableProposal(reviewer, req.params.proposalId!);

    await prisma.$transaction(async (tx) => {
      const flipped = await tx.subtaskProposal.updateMany({
        where: { id: proposal.id, status: "PENDING" },
        data: { status: "REJECTED", reviewedByActorId: reviewer, reviewedAt: new Date() },
      });
      if (flipped.count === 0) throw new ConflictError("Proposal is no longer pending");

      await appendAuditEntry(tx, {
        workspaceId: proposal.workspaceId,
        actorId: reviewer,
        action: "PROPOSAL.REJECT",
        targetType: "Card",
        targetId: proposal.cardId,
        result: "SUCCESS",
        resource: proposal.id,
      });
    }, AUDIT_TX_OPTIONS);

    res.json({ proposalId: proposal.id, status: "REJECTED" });
  } catch (err) {
    next(err);
  }
});

export default router;
