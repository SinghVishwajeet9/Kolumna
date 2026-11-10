// Everything the card detail panel needs, plus the human side of progress
// tracking — the same comments and checklist agents write through MCP tools.
// Each write commits together with its audit entry (roadmap G7).

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { appendAuditEntry, getLineageForTarget, AUDIT_TX_OPTIONS } from "../lib/audit.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { findCardAnyWorkspace } from "../repositories/card.repo.js";

const router = Router();

async function requireCard(actorId: string, cardId: string) {
  const card = await findCardAnyWorkspace(actorId, cardId);
  if (!card) throw new NotFoundError("Card not found");
  return card;
}

router.get("/cards/:cardId/details", requireAuth, async (req, res, next) => {
  try {
    const { id, workspaceId } = await requireCard(req.user!.actorId, req.params.cardId!);
    const [card, activity, cost] = await Promise.all([
      prisma.card.findUnique({
        where: { id },
        include: {
          list: { select: { id: true, title: true, boardId: true } },
          board: { select: { key: true } }, // with `number` → "LB-1"
          epic: { select: { id: true, title: true, color: true } },
          sprint: { select: { id: true, name: true, status: true } },
          assignee: { select: { id: true, displayName: true, type: true } },
          checklistItems: { orderBy: { rank: "asc" } },
          comments: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { id: true, displayName: true, type: true } } },
          },
          subtaskProposals: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
          // Phase 4: gated agent changes waiting on this card, and recent decisions.
          reviews: {
            where: { OR: [{ status: "PENDING" }, { decidedAt: { gt: new Date(Date.now() - 7 * 86_400_000) } }] },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { agent: { select: { actor: { select: { displayName: true } } } } },
          },
        },
      }),
      getLineageForTarget(workspaceId, "Card", id),
      // Phase 5: what agents spent on it (mostly self-reported).
      prisma.costEvent.aggregate({ where: { cardId: id }, _sum: { costUsd: true, tokensIn: true, tokensOut: true }, _count: true }),
    ]);
    res.json({
      ...card,
      cost: {
        costUsd: cost._sum.costUsd?.toFixed(2) ?? null,
        tokens: (cost._sum.tokensIn ?? 0) + (cost._sum.tokensOut ?? 0),
        events: cost._count,
      },
      activity: activity.slice(-30).map((e) => ({
        id: e.id,
        seq: e.seq,
        action: e.action,
        result: e.result,
        actor: { displayName: e.actor.displayName, type: e.actor.type },
        onBehalfOf: e.onBehalfOf ? { displayName: e.onBehalfOf.displayName } : null,
        resource: e.resource,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/cards/:cardId/comments", requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const card = await requireCard(req.user!.actorId, req.params.cardId!);
    const actorId = req.user!.actorId;

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: { workspaceId: card.workspaceId, cardId: card.id, authorActorId: actorId, body: parsed.data.body },
        include: { author: { select: { id: true, displayName: true, type: true } } },
      });
      await appendAuditEntry(tx, {
        workspaceId: card.workspaceId,
        actorId,
        action: "CARD.COMMENT",
        targetType: "Card",
        targetId: card.id,
        result: "SUCCESS",
        resource: c.id,
      });
      return c;
    }, AUDIT_TX_OPTIONS);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

router.post("/cards/:cardId/checklist", requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const card = await requireCard(req.user!.actorId, req.params.cardId!);
    const actorId = req.user!.actorId;

    const item = await prisma.$transaction(async (tx) => {
      const top = await tx.checklistItem.findFirst({ where: { cardId: card.id }, orderBy: { rank: "desc" } });
      const i = await tx.checklistItem.create({
        data: {
          workspaceId: card.workspaceId,
          cardId: card.id,
          title: parsed.data.title,
          rank: top ? top.rank + 1 : 1,
          createdByActorId: actorId,
        },
      });
      await appendAuditEntry(tx, {
        workspaceId: card.workspaceId,
        actorId,
        action: "CHECKLIST.ADD",
        targetType: "Card",
        targetId: card.id,
        result: "SUCCESS",
        resource: i.id,
      });
      return i;
    }, AUDIT_TX_OPTIONS);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.patch("/checklist-items/:itemId", requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ done: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const actorId = req.user!.actorId;
    const item = await prisma.checklistItem.findFirst({
      where: { id: req.params.itemId!, workspace: { members: { some: { actorId } } } },
    });
    if (!item) throw new NotFoundError("Checklist item not found");

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.checklistItem.update({
        where: { id: item.id },
        data: parsed.data.done
          ? { done: true, doneAt: new Date(), doneByActorId: actorId }
          : { done: false, doneAt: null, doneByActorId: null, evidenceUrl: null },
      });
      await appendAuditEntry(tx, {
        workspaceId: item.workspaceId,
        actorId,
        action: parsed.data.done ? "CHECKLIST.TICK" : "CHECKLIST.UNTICK",
        targetType: "Card",
        targetId: item.cardId,
        result: "SUCCESS",
        resource: item.id,
      });
      return u;
    }, AUDIT_TX_OPTIONS);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// For the assignee picker: humans and agents, with each agent's status so the
// UI can grey out ones that can't take work.
router.get(
  "/workspaces/:workspaceId/members",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const memberships = await prisma.membership.findMany({
        where: { workspaceId: req.ctx!.workspaceId },
        include: { actor: { include: { agent: { select: { status: true } }, user: { select: { email: true } } } } },
        orderBy: { createdAt: "asc" },
      });
      res.json(
        memberships.map((m) => ({
          actorId: m.actor.id,
          name: m.actor.displayName,
          type: m.actor.type,
          role: m.role,
          agentStatus: m.actor.agent?.status ?? null,
          email: m.actor.user?.email ?? null, // humans only — teammates see each other's address
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

export default router;
