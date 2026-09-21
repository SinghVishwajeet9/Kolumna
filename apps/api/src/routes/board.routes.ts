import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import * as boardRepo from "../repositories/board.repo.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const router = Router();

const titleSchema = z.object({ title: z.string().min(1) });

// Nested under /workspaces/:workspaceId — requireWorkspaceMember reads
// workspaceId from req.params, so it must match that param name.
router.get(
  "/workspaces/:workspaceId/boards",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const boards = await boardRepo.listBoards(req.ctx!);
      res.json(boards);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/workspaces/:workspaceId/boards",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const parsed = titleSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.message);

      const board = await boardRepo.createBoard(req.ctx!, parsed.data.title);
      res.status(201).json(board);
    } catch (err) {
      next(err);
    }
  },
);

// Single-board routes aren't nested under workspaceId in the URL, so
// requireWorkspaceMember can't run here — it needs that param. Instead we
// look the board up across ALL of the user's workspaces to find which one
// it belongs to, then build ctx from that. Simpler for now: we still
// require login, and getBoardWithContents/update/delete all filter by
// workspaceId internally once we know it.
router.get("/boards/:boardId", requireAuth, async (req, res, next) => {
  try {
    const board = await boardRepo.findBoardAnyWorkspace(req.user!.actorId, req.params.boardId!);
    if (!board) throw new NotFoundError("Board not found");
    res.json(board);
  } catch (err) {
    next(err);
  }
});

router.patch("/boards/:boardId", requireAuth, async (req, res, next) => {
  try {
    const parsed = titleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const board = await boardRepo.findBoardAnyWorkspace(req.user!.actorId, req.params.boardId!);
    if (!board) throw new NotFoundError("Board not found");

    await boardRepo.updateBoard(
      { workspaceId: board.workspaceId, actorId: req.user!.actorId },
      board.id,
      parsed.data.title,
    );
    res.json({ ...board, title: parsed.data.title });
  } catch (err) {
    next(err);
  }
});

router.delete("/boards/:boardId", requireAuth, async (req, res, next) => {
  try {
    const board = await boardRepo.findBoardAnyWorkspace(req.user!.actorId, req.params.boardId!);
    if (!board) throw new NotFoundError("Board not found");

    await boardRepo.deleteBoard(
      { workspaceId: board.workspaceId, actorId: req.user!.actorId },
      board.id,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
