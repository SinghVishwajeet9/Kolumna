import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import * as cardRepo from "../repositories/card.repo.js";
import * as listRepo from "../repositories/list.repo.js";
import { isWorkspaceMember } from "../repositories/workspace.repo.js";
import { calculateRank } from "../services/ranking.js";
import { writeAuditEntry } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const router = Router();

const createCardSchema = z.object({
  title: z.string().min(1),
  // Omitted → joins the board's active sprint (if any). null → the backlog;
  // an id → that planned/active sprint. The backlog page uses the explicit forms.
  sprintId: z.string().nullable().optional(),
});
const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  // The assignee can be a human OR an agent — both are just Actors as of
  // Phase 0. null unassigns; omitted leaves it untouched.
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  // null = no epic / back to the backlog. Both must be on the card's board.
  epicId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
});
const moveCardSchema = z.object({
  listId: z.string(),
  beforeId: z.string().nullable(),
  afterId: z.string().nullable(),
});

router.post("/lists/:listId/cards", requireAuth, async (req, res, next) => {
  try {
    const parsed = createCardSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const list = await listRepo.findListAnyWorkspace(req.user!.actorId, req.params.listId!);
    if (!list) throw new NotFoundError("List not found");

    const ctx = { workspaceId: list.workspaceId, actorId: req.user!.actorId };
    const rank = await cardRepo.getMaxRank(ctx, list.id);
    if (parsed.data.sprintId) {
      const sprint = await prisma.sprint.findFirst({ where: { id: parsed.data.sprintId, boardId: list.boardId } });
      if (!sprint) throw new ValidationError("Sprint is not on this list's board");
      if (sprint.status === "COMPLETED") throw new ValidationError("That sprint is already completed");
    }
    const card = await cardRepo.createCard(ctx, list.id, parsed.data.title, rank, parsed.data.sprintId);
    await writeAuditEntry({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: "CARD.CREATE",
      targetType: "Card",
      targetId: card.id,
      result: "SUCCESS",
    });
    res.status(201).json(card);
  } catch (err) {
    next(err);
  }
});

router.get("/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const card = await cardRepo.findCardAnyWorkspace(req.user!.actorId, req.params.cardId!);
    if (!card) throw new NotFoundError("Card not found");
    res.json(card);
  } catch (err) {
    next(err);
  }
});

router.patch("/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const parsed = updateCardSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const card = await cardRepo.findCardAnyWorkspace(req.user!.actorId, req.params.cardId!);
    if (!card) throw new NotFoundError("Card not found");

    const ctx = { workspaceId: card.workspaceId, actorId: req.user!.actorId };
    const { dueDate, assigneeId, ...rest } = parsed.data;

    if (assigneeId) {
      const isMember = await isWorkspaceMember(ctx.workspaceId, assigneeId);
      if (!isMember) throw new ValidationError("Assignee is not a member of this workspace");
      const agent = await prisma.agent.findUnique({ where: { actorId: assigneeId } });
      if (agent && agent.status !== "ACTIVE") {
        throw new ValidationError(`Can't assign work to an agent that is ${agent.status}`);
      }
    }
    // Epics and sprints are per board: reject one from any other board (incl.
    // another tenant's), and don't let work into a sprint that's finished.
    if (rest.epicId) {
      const epic = await prisma.epic.findFirst({ where: { id: rest.epicId, boardId: card.boardId } });
      if (!epic) throw new ValidationError("Epic is not on this card's board");
    }
    if (rest.sprintId) {
      const sprint = await prisma.sprint.findFirst({ where: { id: rest.sprintId, boardId: card.boardId } });
      if (!sprint) throw new ValidationError("Sprint is not on this card's board");
      if (sprint.status === "COMPLETED") throw new ValidationError("That sprint is already completed");
    }

    await cardRepo.updateCard(ctx, card.id, {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
    });

    // Assignment is the audit-worthy event the whole thesis hinges on — who
    // handed what to whom — so it gets its own action name distinct from a
    // plain field edit, even though both go through this one endpoint.
    if (assigneeId !== undefined) {
      await writeAuditEntry({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        action: "CARD.ASSIGN",
        targetType: "Card",
        targetId: card.id,
        result: "SUCCESS",
        resource: assigneeId ?? "unassigned",
      });
    }
    if (Object.keys(rest).length > 0 || dueDate !== undefined) {
      await writeAuditEntry({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        action: "CARD.UPDATE",
        targetType: "Card",
        targetId: card.id,
        result: "SUCCESS",
      });
    }

    res.json({ ...card, ...parsed.data });
  } catch (err) {
    next(err);
  }
});

router.delete("/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const card = await cardRepo.findCardAnyWorkspace(req.user!.actorId, req.params.cardId!);
    if (!card) throw new NotFoundError("Card not found");

    const ctx = { workspaceId: card.workspaceId, actorId: req.user!.actorId };
    await cardRepo.deleteCard(ctx, card.id);
    await writeAuditEntry({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: "CARD.DELETE",
      targetType: "Card",
      targetId: card.id,
      result: "SUCCESS",
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// The drag-and-drop endpoint. Client sends WHERE it was dropped (neighbor
// IDs), never a rank — the server is the only thing that computes ranks.
// See services/ranking.ts and ARCHITECTURE.md §6, Decision 2.
router.patch("/cards/:cardId/move", requireAuth, async (req, res, next) => {
  try {
    const parsed = moveCardSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const card = await cardRepo.findCardAnyWorkspace(req.user!.actorId, req.params.cardId!);
    if (!card) throw new NotFoundError("Card not found");

    const ctx = { workspaceId: card.workspaceId, actorId: req.user!.actorId };
    const { beforeId, afterId, listId } = parsed.data;

    const { beforeRank, afterRank } = await cardRepo.getNeighborRanks(ctx, beforeId, afterId);
    const newRank = calculateRank(beforeRank, afterRank);

    const moved = await cardRepo.moveCard(ctx, card.id, listId, newRank);
    if (moved.count === 0) throw new NotFoundError("List not found");
    await writeAuditEntry({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: "CARD.MOVE",
      targetType: "Card",
      targetId: card.id,
      result: "SUCCESS",
      resource: listId,
    });
    res.json({ ...card, listId, rank: newRank });
  } catch (err) {
    next(err);
  }
});

export default router;
