import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import * as boardRepo from "../repositories/board.repo.js";
import * as listRepo from "../repositories/list.repo.js";
import { writeAuditEntry } from "../lib/audit.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const router = Router();

const titleSchema = z.object({ title: z.string().min(1) });

// Same pattern as /boards/:id — find the board through the user's
// membership first (proves access + gives us the real workspaceId), THEN
// build a proper TenantContext to pass into the ctx-scoped list functions.
async function requireBoardAccess(actorId: string, boardId: string) {
  const board = await boardRepo.findBoardAnyWorkspace(actorId, boardId);
  if (!board) throw new NotFoundError("Board not found");
  return board;
}

router.post("/boards/:boardId/lists", requireAuth, async (req, res, next) => {
  try {
    const parsed = titleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const board = await requireBoardAccess(req.user!.actorId, req.params.boardId!);
    const ctx = { workspaceId: board.workspaceId, actorId: req.user!.actorId };

    const rank = await listRepo.getMaxRank(ctx, board.id);
    const list = await listRepo.createList(ctx, board.id, parsed.data.title, rank);
    await writeAuditEntry({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: "LIST.CREATE",
      targetType: "List",
      targetId: list.id,
      result: "SUCCESS",
    });
    res.status(201).json(list);
  } catch (err) {
    next(err);
  }
});

router.patch("/lists/:listId", requireAuth, async (req, res, next) => {
  try {
    const parsed = titleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    // We don't have the boardId here, so find the list's workspace via the
    // same any-workspace-the-user-belongs-to pattern, scoped to List instead
    // of Board — see listRepo.findListAnyWorkspace below.
    const list = await listRepo.findListAnyWorkspace(req.user!.actorId, req.params.listId!);
    if (!list) throw new NotFoundError("List not found");

    const ctx = { workspaceId: list.workspaceId, actorId: req.user!.actorId };
    await listRepo.updateList(ctx, list.id, parsed.data.title);
    await writeAuditEntry({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: "LIST.UPDATE",
      targetType: "List",
      targetId: list.id,
      result: "SUCCESS",
    });
    res.json({ ...list, title: parsed.data.title });
  } catch (err) {
    next(err);
  }
});

router.delete("/lists/:listId", requireAuth, async (req, res, next) => {
  try {
    const list = await listRepo.findListAnyWorkspace(req.user!.actorId, req.params.listId!);
    if (!list) throw new NotFoundError("List not found");

    const ctx = { workspaceId: list.workspaceId, actorId: req.user!.actorId };
    await listRepo.deleteList(ctx, list.id);
    await writeAuditEntry({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: "LIST.DELETE",
      targetType: "List",
      targetId: list.id,
      result: "SUCCESS",
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
