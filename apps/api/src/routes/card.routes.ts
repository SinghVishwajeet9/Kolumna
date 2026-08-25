import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import * as cardRepo from "../repositories/card.repo.js";
import * as listRepo from "../repositories/list.repo.js";
import { calculateRank } from "../services/ranking.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const router = Router();

const createCardSchema = z.object({ title: z.string().min(1) });
const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
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

    const list = await listRepo.findListAnyWorkspace(req.user!.id, req.params.listId!);
    if (!list) throw new NotFoundError("List not found");

    const ctx = { workspaceId: list.workspaceId, userId: req.user!.id };
    const rank = await cardRepo.getMaxRank(ctx, list.id);
    const card = await cardRepo.createCard(ctx, list.id, parsed.data.title, rank);
    res.status(201).json(card);
  } catch (err) {
    next(err);
  }
});

router.get("/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const card = await cardRepo.findCardAnyWorkspace(req.user!.id, req.params.cardId!);
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

    const card = await cardRepo.findCardAnyWorkspace(req.user!.id, req.params.cardId!);
    if (!card) throw new NotFoundError("Card not found");

    const ctx = { workspaceId: card.workspaceId, userId: req.user!.id };
    const { dueDate, ...rest } = parsed.data;
    await cardRepo.updateCard(ctx, card.id, {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    });
    res.json({ ...card, ...parsed.data });
  } catch (err) {
    next(err);
  }
});

router.delete("/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const card = await cardRepo.findCardAnyWorkspace(req.user!.id, req.params.cardId!);
    if (!card) throw new NotFoundError("Card not found");

    const ctx = { workspaceId: card.workspaceId, userId: req.user!.id };
    await cardRepo.deleteCard(ctx, card.id);
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

    const card = await cardRepo.findCardAnyWorkspace(req.user!.id, req.params.cardId!);
    if (!card) throw new NotFoundError("Card not found");

    const ctx = { workspaceId: card.workspaceId, userId: req.user!.id };
    const { beforeId, afterId, listId } = parsed.data;

    const { beforeRank, afterRank } = await cardRepo.getNeighborRanks(ctx, beforeId, afterId);
    const newRank = calculateRank(beforeRank, afterRank);

    await cardRepo.moveCard(ctx, card.id, listId, newRank);
    res.json({ ...card, listId, rank: newRank });
  } catch (err) {
    next(err);
  }
});

export default router;
