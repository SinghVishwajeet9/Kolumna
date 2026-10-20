// Phase 4 — the approvals inbox for gated agent actions (ConfidenceReview).
// Cookie-session routes only, so no agent can approve anything. Listing is
// open to members; deciding is OWNER/ADMIN (G11).

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { assertWorkspaceAdmin } from "../middleware/requireWorkspaceAdmin.js";
import { ValidationError } from "../lib/errors.js";
import { approveReview, findReview, rejectReview } from "../gateway/reviews.js";

const router = Router();

router.get("/workspaces/:workspaceId/reviews", requireAuth, requireWorkspaceMember, async (req, res, next) => {
  try {
    const status = z.enum(["PENDING", "APPROVED", "REJECTED", "FAILED"]).optional().safeParse(req.query.status);
    if (!status.success) throw new ValidationError("Unknown status");
    const reviews = await prisma.confidenceReview.findMany({
      where: { workspaceId: req.ctx!.workspaceId, ...(status.data ? { status: status.data } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        agent: { select: { id: true, actor: { select: { displayName: true } } } },
        card: { select: { id: true, number: true, title: true, board: { select: { key: true } } } },
      },
    });
    res.json(
      reviews.map(({ agent, card, input: _input, ...r }) => ({
        ...r,
        agent: { id: agent.id, displayName: agent.actor.displayName },
        card: card ? { id: card.id, key: `${card.board.key}-${card.number}`, title: card.title } : null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/reviews/:reviewId/approve", requireAuth, async (req, res, next) => {
  try {
    const review = await findReview(req.user!.actorId, req.params.reviewId!);
    await assertWorkspaceAdmin(req.user!.actorId, review.workspaceId);
    res.json(await approveReview(review.id, req.user!.actorId));
  } catch (err) {
    next(err);
  }
});

router.post("/reviews/:reviewId/reject", requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ note: z.string().trim().max(1000).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const review = await findReview(req.user!.actorId, req.params.reviewId!);
    await assertWorkspaceAdmin(req.user!.actorId, review.workspaceId);
    res.json(await rejectReview(review.id, req.user!.actorId, parsed.data.note || null));
  } catch (err) {
    next(err);
  }
});

export default router;
