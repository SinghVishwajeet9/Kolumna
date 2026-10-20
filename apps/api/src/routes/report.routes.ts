// Phase 6 — blended reporting: one burndown for the whole sprint, split by
// who finished the work (humans vs agents), next to both kinds of capacity
// (human hours, agent budget); and each agent's track record.

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { NotFoundError } from "../lib/errors.js";
import { budgetSpend } from "../lib/cost.js";
import { computeReliability, suggestAutonomy } from "../lib/reliability.js";

const router = Router();
const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

router.get("/sprints/:sprintId/report", requireAuth, async (req, res, next) => {
  try {
    const actorId = req.user!.actorId;
    const sprint = await prisma.sprint.findFirst({
      where: { id: req.params.sprintId!, workspace: { members: { some: { actorId } } } },
      include: { board: { select: { id: true, key: true, title: true } } },
    });
    if (!sprint) throw new NotFoundError("Sprint not found");

    const [cards, budget, cost, snapshots] = await Promise.all([
      prisma.card.findMany({
        where: { sprintId: sprint.id },
        select: { id: true, number: true, title: true, storyPoints: true, doneAt: true, doneAssigneeId: true, assigneeId: true },
      }),
      prisma.usageBudget.findFirst({ where: { sprintId: sprint.id } }),
      prisma.costEvent.aggregate({ where: { sprintId: sprint.id }, _sum: { costUsd: true, tokensIn: true, tokensOut: true } }),
      prisma.agentReliability.findMany({
        where: { sprintId: sprint.id },
        include: { agent: { select: { actor: { select: { displayName: true } } } } },
      }),
    ]);
    const actorIds = [...new Set(cards.flatMap((c) => [c.doneAssigneeId, c.assigneeId]).filter((x): x is string => !!x))];
    const actors = await prisma.actor.findMany({ where: { id: { in: actorIds } }, select: { id: true, type: true } });
    const typeOf = (id: string | null) => (id ? (actors.find((a) => a.id === id)?.type ?? null) : null);
    const pts = (c: { storyPoints: number | null }) => c.storyPoints ?? 0;

    // Scope = what's in the sprint now, plus what left unfinished at completion.
    const scope = cards.reduce((n, c) => n + pts(c), 0) + (sprint.carriedOverPoints ?? 0);
    const done = cards.filter((c) => c.doneAt);
    const donePts = (filter: (c: (typeof cards)[number]) => boolean) => done.filter(filter).reduce((n, c) => n + pts(c), 0);

    // Daily series from the first day to today (or the end, once it's over).
    const start = dayStart(sprint.startsAt ?? sprint.createdAt);
    const plannedEnd = dayStart(sprint.endsAt ?? new Date(start.getTime() + 13 * DAY));
    const last = dayStart(sprint.completedAt ?? new Date());
    const days: { date: string; remaining: number | null; doneHuman: number | null; doneAgent: number | null; ideal: number }[] = [];
    const span = Math.max(1, Math.round((plannedEnd.getTime() - start.getTime()) / DAY));
    const through = Math.max(plannedEnd.getTime(), last.getTime());
    for (let t = start.getTime(), i = 0; t <= through; t += DAY, i++) {
      const end = new Date(t + DAY);
      const future = t > last.getTime();
      const by = (c: (typeof cards)[number]) => !!c.doneAt && c.doneAt < end;
      days.push({
        date: new Date(t).toISOString().slice(0, 10),
        ideal: Math.max(0, Math.round((scope * (1 - i / span)) * 10) / 10),
        remaining: future ? null : scope - donePts(by),
        doneHuman: future ? null : donePts((c) => by(c) && typeOf(c.doneAssigneeId) === "HUMAN"),
        doneAgent: future ? null : donePts((c) => by(c) && typeOf(c.doneAssigneeId) === "AGENT"),
      });
    }

    const committedBy = (type: "HUMAN" | "AGENT") => cards.filter((c) => typeOf(c.assigneeId) === type).reduce((n, c) => n + pts(c), 0);
    const agentSpend = budget ? await budgetSpend(prisma, budget) : null;
    const costUsd = cost._sum.costUsd;
    const doneTotal = donePts(() => true);

    res.json({
      sprint: {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        status: sprint.status,
        startsAt: sprint.startsAt,
        endsAt: sprint.endsAt,
        completedAt: sprint.completedAt,
        board: sprint.board,
      },
      points: {
        scope,
        done: doneTotal,
        doneByHumans: donePts((c) => typeOf(c.doneAssigneeId) === "HUMAN"),
        doneByAgents: donePts((c) => typeOf(c.doneAssigneeId) === "AGENT"),
        carriedOver: sprint.carriedOverPoints ?? 0,
        // Who it's planned for (current assignee) — the blended commitment.
        committedToHumans: committedBy("HUMAN"),
        committedToAgents: committedBy("AGENT"),
        unassigned: cards.filter((c) => !c.assigneeId).reduce((n, c) => n + pts(c), 0),
      },
      capacity: {
        humanHours: sprint.humanCapacityHours,
        agentBudgetUsd: budget?.costCapUsd?.toFixed(2) ?? null,
        agentSpentUsd: (agentSpend?.usd ?? costUsd)?.toFixed(2) ?? "0.00",
      },
      cost: {
        usd: costUsd?.toFixed(2) ?? "0.00",
        tokens: (cost._sum.tokensIn ?? 0) + (cost._sum.tokensOut ?? 0),
        usdPerPoint: costUsd && doneTotal ? costUsd.div(doneTotal).toFixed(2) : null,
      },
      days,
      // Completed sprints show their snapshot; a running one has none yet.
      agents: snapshots.map(({ agent, costUsd: c, ...r }) => ({ name: agent.actor.displayName, ...r, costUsd: c?.toFixed(2) ?? null })),
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/workspaces/:workspaceId/agents/:agentId/reliability",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const agent = await prisma.agent.findFirst({
        where: { id: req.params.agentId!, workspaceId: req.ctx!.workspaceId },
        select: { id: true, actorId: true, workspaceId: true, autonomyLevel: true },
      });
      if (!agent) throw new NotFoundError("Agent not found");
      const [last30, trend] = await Promise.all([
        computeReliability(prisma, agent, { since: new Date(Date.now() - 30 * DAY) }),
        prisma.agentReliability.findMany({
          where: { agentId: agent.id },
          orderBy: { createdAt: "asc" },
          include: { sprint: { select: { name: true } } },
        }),
      ]);
      res.json({
        level: agent.autonomyLevel,
        last30,
        suggestion: suggestAutonomy(agent.autonomyLevel, last30),
        trend: trend.map(({ sprint, costUsd, ...r }) => ({ sprint: sprint.name, ...r, costUsd: costUsd?.toFixed(2) ?? null })),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
