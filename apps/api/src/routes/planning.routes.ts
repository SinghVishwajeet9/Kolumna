// Phase 3.5 planning: epics, sprints and the backlog — all per board.
//
// "Done" means "in the board's LAST column" (Jira's default convention). It
// decides which cards a completed sprint leaves behind, and epic progress.
//
// Every write commits atomically with its audit entry (roadmap G7).

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { appendAuditEntry, AUDIT_TX_OPTIONS, type Tx } from "../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";

const router = Router();

// Board access through membership, like every other board route.
async function requireBoard(actorId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, workspace: { members: { some: { actorId } } } },
    select: { id: true, workspaceId: true, key: true, title: true },
  });
  if (!board) throw new NotFoundError("Board not found");
  return board;
}

async function requireSprint(actorId: string, sprintId: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, workspace: { members: { some: { actorId } } } },
  });
  if (!sprint) throw new NotFoundError("Sprint not found");
  return sprint;
}

async function doneListId(tx: Tx | typeof prisma, boardId: string) {
  const last = await tx.list.findFirst({ where: { boardId }, orderBy: { rank: "desc" }, select: { id: true } });
  return last?.id ?? null;
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 } as const;

// The compact card shape for backlog/sprint lists.
const backlogCardInclude = {
  assignee: { select: { id: true, displayName: true, type: true } },
  epic: { select: { id: true, title: true, color: true } },
  list: { select: { id: true, title: true } },
} as const;

function sortCards<T extends { priority: keyof typeof PRIORITY_ORDER; createdAt: Date }>(cards: T[]) {
  return [...cards].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

// --- Epics --------------------------------------------------------------------

router.get("/boards/:boardId/epics", requireAuth, async (req, res, next) => {
  try {
    const board = await requireBoard(req.user!.actorId, req.params.boardId!);
    const done = await doneListId(prisma, board.id);
    const [epics, costs] = await Promise.all([
      prisma.epic.findMany({
        where: { boardId: board.id },
        orderBy: { createdAt: "asc" },
        include: { cards: { select: { listId: true } } },
      }),
      prisma.costEvent.groupBy({ by: ["epicId"], where: { boardId: board.id, epicId: { not: null } }, _sum: { costUsd: true } }),
    ]);
    res.json(
      epics.map(({ cards, ...e }) => ({
        ...e,
        cardCount: cards.length,
        doneCount: cards.filter((c) => c.listId === done).length,
        costUsd: costs.find((c) => c.epicId === e.id)?._sum.costUsd?.toFixed(2) ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

const epicSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(5000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.post("/boards/:boardId/epics", requireAuth, async (req, res, next) => {
  try {
    const parsed = epicSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const board = await requireBoard(req.user!.actorId, req.params.boardId!);
    const epic = await prisma.$transaction(async (tx) => {
      const e = await tx.epic.create({
        data: { ...parsed.data, boardId: board.id, workspaceId: board.workspaceId },
      });
      await appendAuditEntry(tx, {
        workspaceId: board.workspaceId,
        actorId: req.user!.actorId,
        action: "EPIC.CREATE",
        targetType: "Epic",
        targetId: e.id,
        result: "SUCCESS",
      });
      return e;
    }, AUDIT_TX_OPTIONS);
    res.status(201).json(epic);
  } catch (err) {
    next(err);
  }
});

// --- Sprints ------------------------------------------------------------------

router.get("/boards/:boardId/sprints", requireAuth, async (req, res, next) => {
  try {
    const board = await requireBoard(req.user!.actorId, req.params.boardId!);
    const sprints = await prisma.sprint.findMany({
      where: { boardId: board.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { cards: true } } },
    });
    res.json(sprints);
  } catch (err) {
    next(err);
  }
});

// Planned and active sprints across the workspace, for pickers that aren't
// scoped to one board (e.g. "this agent's access ends with sprint X").
router.get("/workspaces/:workspaceId/sprints", requireAuth, requireWorkspaceMember, async (req, res, next) => {
  try {
    const sprints = await prisma.sprint.findMany({
      where: { workspaceId: req.ctx!.workspaceId, status: { in: ["ACTIVE", "PLANNED"] } },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }], // enum order PLANNED < ACTIVE: active first
      select: { id: true, name: true, status: true, endsAt: true, board: { select: { id: true, title: true } } },
    });
    res.json(sprints);
  } catch (err) {
    next(err);
  }
});

router.post("/boards/:boardId/sprints", requireAuth, async (req, res, next) => {
  try {
    const parsed = z
      .object({ name: z.string().trim().min(1).max(80).optional(), goal: z.string().max(500).optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const board = await requireBoard(req.user!.actorId, req.params.boardId!);
    const sprint = await prisma.$transaction(async (tx) => {
      const count = await tx.sprint.count({ where: { boardId: board.id } });
      const s = await tx.sprint.create({
        data: {
          boardId: board.id,
          workspaceId: board.workspaceId,
          name: parsed.data.name ?? `${board.key} Sprint ${count + 1}`,
          goal: parsed.data.goal,
        },
      });
      await appendAuditEntry(tx, {
        workspaceId: board.workspaceId,
        actorId: req.user!.actorId,
        action: "SPRINT.CREATE",
        targetType: "Sprint",
        targetId: s.id,
        result: "SUCCESS",
      });
      return s;
    }, AUDIT_TX_OPTIONS);
    res.status(201).json(sprint);
  } catch (err) {
    next(err);
  }
});

router.patch("/sprints/:sprintId", requireAuth, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        goal: z.string().max(500).nullable().optional(),
        endsAt: z.string().datetime().nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const sprint = await requireSprint(req.user!.actorId, req.params.sprintId!);
    const { endsAt, ...rest } = parsed.data;
    const updated = await prisma.sprint.update({
      where: { id: sprint.id },
      data: { ...rest, ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/sprints/:sprintId/start", requireAuth, async (req, res, next) => {
  try {
    const parsed = z
      .object({ endsAt: z.string().datetime().optional(), goal: z.string().max(500).optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const sprint = await requireSprint(req.user!.actorId, req.params.sprintId!);
    if (sprint.status !== "PLANNED") throw new ValidationError(`Sprint is already ${sprint.status.toLowerCase()}`);

    const startsAt = new Date();
    // Default length: two weeks.
    const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : new Date(startsAt.getTime() + 14 * 86_400_000);
    try {
      const started = await prisma.$transaction(async (tx) => {
        const s = await tx.sprint.update({
          where: { id: sprint.id },
          data: { status: "ACTIVE", startsAt, endsAt, ...(parsed.data.goal ? { goal: parsed.data.goal } : {}) },
        });
        await appendAuditEntry(tx, {
          workspaceId: sprint.workspaceId,
          actorId: req.user!.actorId,
          action: "SPRINT.START",
          targetType: "Sprint",
          targetId: sprint.id,
          result: "SUCCESS",
        });
        return s;
      }, AUDIT_TX_OPTIONS);
      res.json(started);
    } catch (err) {
      // The partial unique index (one ACTIVE sprint per board) — the database
      // settles the race, not an app-level "is another one active?" check.
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictError("This board already has an active sprint — complete it first");
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.post("/sprints/:sprintId/complete", requireAuth, async (req, res, next) => {
  try {
    const parsed = z
      // Where unfinished cards go: back to the backlog (null) or into another sprint.
      .object({ moveOpenCardsTo: z.string().nullable().default(null) })
      .safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const sprint = await requireSprint(req.user!.actorId, req.params.sprintId!);
    if (sprint.status !== "ACTIVE") throw new ValidationError("Only an active sprint can be completed");

    const target = parsed.data.moveOpenCardsTo;
    if (target) {
      const next = await prisma.sprint.findFirst({ where: { id: target, boardId: sprint.boardId, status: "PLANNED" } });
      if (!next) throw new ValidationError("Unfinished cards can only move to a planned sprint on the same board");
    }

    const result = await prisma.$transaction(async (tx) => {
      const done = await doneListId(tx, sprint.boardId);
      const moved = await tx.card.updateMany({
        where: { sprintId: sprint.id, ...(done ? { listId: { not: done } } : {}) },
        data: { sprintId: target },
      });
      const completed = await tx.sprint.update({
        where: { id: sprint.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      // G14: agents brought in for this sprint lose access with it — their
      // live grants die now, not at their natural expiry.
      const bound = await tx.agent.findMany({ where: { accessSprintId: sprint.id }, select: { id: true } });
      for (const agent of bound) {
        const revoked = await tx.agentGrant.updateMany({
          where: { agentId: agent.id, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { revokedAt: new Date() },
        });
        await appendAuditEntry(tx, {
          workspaceId: sprint.workspaceId,
          actorId: req.user!.actorId,
          action: "AGENT.ACCESS_ENDED",
          targetType: "Agent",
          targetId: agent.id,
          result: "SUCCESS",
          resource: `${sprint.name} completed; ${revoked.count} live grants revoked`,
        });
      }
      await appendAuditEntry(tx, {
        workspaceId: sprint.workspaceId,
        actorId: req.user!.actorId,
        action: "SPRINT.COMPLETE",
        targetType: "Sprint",
        targetId: sprint.id,
        result: "SUCCESS",
        resource: `${moved.count} unfinished cards → ${target ?? "backlog"}`,
      });
      return { sprint: completed, movedCards: moved.count };
    }, AUDIT_TX_OPTIONS);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- Backlog --------------------------------------------------------------------

// Everything a planning page needs in one request: active + planned sprints
// with their cards, and the backlog (cards in no sprint) — each list sorted
// by priority, then age.
router.get("/boards/:boardId/backlog", requireAuth, async (req, res, next) => {
  try {
    const board = await requireBoard(req.user!.actorId, req.params.boardId!);
    const [sprints, backlog, lists, costs] = await Promise.all([
      prisma.sprint.findMany({
        where: { boardId: board.id, status: { in: ["ACTIVE", "PLANNED"] } },
        orderBy: { createdAt: "asc" },
        include: { cards: { include: backlogCardInclude } },
      }),
      prisma.card.findMany({ where: { boardId: board.id, sprintId: null }, include: backlogCardInclude }),
      prisma.list.findMany({ where: { boardId: board.id }, orderBy: { rank: "asc" }, select: { id: true, title: true } }),
      prisma.costEvent.groupBy({ by: ["sprintId"], where: { boardId: board.id, sprintId: { not: null } }, _sum: { costUsd: true } }),
    ]);
    res.json({
      board,
      lists, // new cards land in the first; the last one is "done"
      doneListId: lists.at(-1)?.id ?? null,
      // Active sprint first, then planned ones in creation order.
      sprints: [...sprints]
        .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE"))
        .map((s) => ({
          ...s,
          cards: sortCards(s.cards),
          costUsd: costs.find((c) => c.sprintId === s.id)?._sum.costUsd?.toFixed(2) ?? null,
        })),
      backlog: sortCards(backlog),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
