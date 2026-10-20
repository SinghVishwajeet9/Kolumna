// Phase 5 — where the money went, and the limits on it. Reading is open to
// members; budgets, prices and manual entries are OWNER/ADMIN (G11).
// Money leaves the API as strings ("12.34"), never floats.

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { requireWorkspaceAdmin, assertWorkspaceAdmin } from "../middleware/requireWorkspaceAdmin.js";
import { appendAuditEntry, AUDIT_TX_OPTIONS } from "../lib/audit.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { budgetSpend, recordCost, refreshBudget, startOfMonth } from "../lib/cost.js";

const router = Router();

const usd = (d: { toFixed: (n: number) => string } | null | undefined) => (d ? d.toFixed(2) : "0.00");

router.get("/workspaces/:workspaceId/usage", requireAuth, requireWorkspaceMember, async (req, res, next) => {
  try {
    const workspaceId = req.ctx!.workspaceId;
    const month = startOfMonth();
    const sum = { costUsd: true, tokensIn: true, tokensOut: true } as const;
    const [monthTotal, bySource, byAgent, bySprint, byEpic, recent] = await Promise.all([
      prisma.costEvent.aggregate({ where: { workspaceId, createdAt: { gte: month } }, _sum: sum, _count: true }),
      prisma.costEvent.groupBy({ by: ["source"], where: { workspaceId, createdAt: { gte: month } }, _sum: { costUsd: true } }),
      prisma.costEvent.groupBy({ by: ["agentId"], where: { workspaceId, createdAt: { gte: month } }, _sum: sum, _count: true }),
      prisma.costEvent.groupBy({ by: ["sprintId"], where: { workspaceId, sprintId: { not: null } }, _sum: sum }),
      prisma.costEvent.groupBy({ by: ["epicId"], where: { workspaceId, epicId: { not: null } }, _sum: sum }),
      prisma.costEvent.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { card: { select: { number: true, title: true, board: { select: { key: true } } } } },
      }),
    ]);
    const [agents, sprints, epics] = await Promise.all([
      prisma.agent.findMany({ where: { workspaceId }, select: { id: true, actor: { select: { displayName: true } } } }),
      prisma.sprint.findMany({
        where: { id: { in: bySprint.map((s) => s.sprintId!) } },
        select: { id: true, name: true, status: true, board: { select: { title: true } }, cards: { select: { storyPoints: true } } },
      }),
      prisma.epic.findMany({ where: { id: { in: byEpic.map((e) => e.epicId!) } }, select: { id: true, title: true, color: true } }),
    ]);
    const agentName = (id: string | null) => agents.find((a) => a.id === id)?.actor.displayName ?? "Humans / unattributed";
    const tokens = (s: { tokensIn: number | null; tokensOut: number | null }) => (s.tokensIn ?? 0) + (s.tokensOut ?? 0);

    res.json({
      month: {
        from: month,
        costUsd: usd(monthTotal._sum.costUsd),
        tokens: tokens(monthTotal._sum),
        events: monthTotal._count,
        // Connected agents' numbers are their own report — say how much of the
        // total that is, rather than presenting it all as measured.
        selfReportedUsd: usd(bySource.find((s) => s.source === "SELF_REPORTED")?._sum.costUsd),
      },
      byAgent: byAgent
        .map((a) => ({ agentId: a.agentId, name: agentName(a.agentId), costUsd: usd(a._sum.costUsd), tokens: tokens(a._sum), events: a._count }))
        .sort((x, y) => Number(y.costUsd) - Number(x.costUsd)),
      bySprint: bySprint.map((s) => {
        const sp = sprints.find((x) => x.id === s.sprintId);
        const points = sp?.cards.reduce((n, c) => n + (c.storyPoints ?? 0), 0) ?? 0;
        return {
          sprintId: s.sprintId,
          name: sp?.name ?? "?",
          board: sp?.board.title ?? "",
          status: sp?.status ?? null,
          costUsd: usd(s._sum.costUsd),
          tokens: tokens(s._sum),
          points,
          // The number the roadmap promised: agent cost next to story points.
          usdPerPoint: points && s._sum.costUsd ? s._sum.costUsd.div(points).toFixed(2) : null,
        };
      }),
      byEpic: byEpic.map((e) => {
        const ep = epics.find((x) => x.id === e.epicId);
        return { epicId: e.epicId, title: ep?.title ?? "?", color: ep?.color ?? "#999", costUsd: usd(e._sum.costUsd), tokens: tokens(e._sum) };
      }),
      recent: recent.map((e) => ({
        id: e.id,
        at: e.createdAt,
        agent: agentName(e.agentId),
        source: e.source,
        card: e.card ? `${e.card.board.key}-${e.card.number} ${e.card.title}` : null,
        model: e.model,
        tokens: e.tokensIn + e.tokensOut,
        costUsd: e.costUsd?.toFixed(4) ?? null,
        note: e.note,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// --- Budgets -----------------------------------------------------------------

async function withStatus(b: Awaited<ReturnType<typeof prisma.usageBudget.findFirstOrThrow>>) {
  const spent = await budgetSpend(prisma, b);
  const costFrac = b.costCapUsd && b.costCapUsd.gt(0) ? spent.usd.div(b.costCapUsd).toNumber() : 0;
  const tokenFrac = b.tokenCap ? spent.tokens / b.tokenCap : 0;
  const fraction = Math.max(costFrac, tokenFrac);
  return {
    id: b.id,
    sprintId: b.sprintId,
    agentId: b.agentId,
    scope: b.sprintId ? "SPRINT" : b.agentId ? "AGENT_MONTH" : "WORKSPACE_MONTH",
    costCapUsd: b.costCapUsd?.toFixed(2) ?? null,
    tokenCap: b.tokenCap,
    alertAt: b.alertAt,
    spentUsd: spent.usd.toFixed(2),
    spentTokens: spent.tokens,
    fraction,
    state: fraction >= 1 ? "EXCEEDED" : fraction >= b.alertAt ? "ALERT" : "OK",
  };
}

router.get("/workspaces/:workspaceId/budgets", requireAuth, requireWorkspaceMember, async (req, res, next) => {
  try {
    const budgets = await prisma.usageBudget.findMany({ where: { workspaceId: req.ctx!.workspaceId }, orderBy: { createdAt: "asc" } });
    res.json(await Promise.all(budgets.map(withStatus)));
  } catch (err) {
    next(err);
  }
});

const budgetSchema = z
  .object({
    sprintId: z.string().nullable().optional(),
    agentId: z.string().nullable().optional(),
    costCapUsd: z.number().positive().max(10_000_000).nullable().optional(),
    tokenCap: z.number().int().positive().nullable().optional(),
    alertAt: z.number().gt(0).max(1).optional(),
  })
  .refine((b) => b.costCapUsd != null || b.tokenCap != null, { message: "Set costCapUsd and/or tokenCap" })
  .refine((b) => !(b.sprintId && b.agentId), { message: "A budget covers a sprint, an agent, or the workspace — not both" });

router.post("/workspaces/:workspaceId/budgets", requireAuth, requireWorkspaceAdmin, async (req, res, next) => {
  try {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const workspaceId = req.ctx!.workspaceId;
    const { sprintId, agentId, costCapUsd, tokenCap, alertAt } = parsed.data;
    if (sprintId && !(await prisma.sprint.findFirst({ where: { id: sprintId, workspaceId } }))) throw new ValidationError("Sprint not in this workspace");
    if (agentId && !(await prisma.agent.findFirst({ where: { id: agentId, workspaceId } }))) throw new ValidationError("Agent not in this workspace");

    const budget = await prisma.$transaction(async (tx) => {
      const b = await tx.usageBudget.create({
        data: { workspaceId, sprintId: sprintId ?? null, agentId: agentId ?? null, costCapUsd: costCapUsd ?? null, tokenCap: tokenCap ?? null, ...(alertAt ? { alertAt } : {}) },
      });
      await appendAuditEntry(tx, {
        workspaceId,
        actorId: req.ctx!.actorId,
        action: "BUDGET.CREATE",
        targetType: "UsageBudget",
        targetId: b.id,
        result: "SUCCESS",
        resource: JSON.stringify({ sprintId, agentId, costCapUsd, tokenCap }),
      });
      await refreshBudget(tx, b, req.ctx!.actorId); // it may already be over
      return b;
    }, AUDIT_TX_OPTIONS);
    res.status(201).json(await withStatus(await prisma.usageBudget.findUniqueOrThrow({ where: { id: budget.id } })));
  } catch (err) {
    next(err);
  }
});

async function requireBudget(actorId: string, id: string) {
  const b = await prisma.usageBudget.findFirst({ where: { id, workspace: { members: { some: { actorId } } } } });
  if (!b) throw new NotFoundError("Budget not found");
  await assertWorkspaceAdmin(actorId, b.workspaceId);
  return b;
}

// Raising a cap is how a human lets an over-budget agent act on its own
// again: the exceeded flag clears as soon as spend is back under.
router.patch("/budgets/:budgetId", requireAuth, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        costCapUsd: z.number().positive().max(10_000_000).nullable().optional(),
        tokenCap: z.number().int().positive().nullable().optional(),
        alertAt: z.number().gt(0).max(1).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const b = await requireBudget(req.user!.actorId, req.params.budgetId!);
    const next_ = {
      costCapUsd: parsed.data.costCapUsd !== undefined ? parsed.data.costCapUsd : b.costCapUsd?.toNumber() ?? null,
      tokenCap: parsed.data.tokenCap !== undefined ? parsed.data.tokenCap : b.tokenCap,
    };
    if (next_.costCapUsd == null && next_.tokenCap == null) throw new ValidationError("A budget needs a cost or token cap");

    await prisma.$transaction(async (tx) => {
      const u = await tx.usageBudget.update({
        where: { id: b.id },
        data: { ...next_, ...(parsed.data.alertAt ? { alertAt: parsed.data.alertAt } : {}) },
      });
      await appendAuditEntry(tx, {
        workspaceId: b.workspaceId,
        actorId: req.user!.actorId,
        action: "BUDGET.UPDATE",
        targetType: "UsageBudget",
        targetId: b.id,
        result: "SUCCESS",
        resource: `cap $${b.costCapUsd?.toFixed(2) ?? "-"} -> $${u.costCapUsd?.toFixed(2) ?? "-"}, tokens ${b.tokenCap ?? "-"} -> ${u.tokenCap ?? "-"}`,
      });
      await refreshBudget(tx, u, req.user!.actorId);
    }, AUDIT_TX_OPTIONS);
    res.json(await withStatus(await prisma.usageBudget.findUniqueOrThrow({ where: { id: b.id } })));
  } catch (err) {
    next(err);
  }
});

router.delete("/budgets/:budgetId", requireAuth, async (req, res, next) => {
  try {
    const b = await requireBudget(req.user!.actorId, req.params.budgetId!);
    await prisma.$transaction(async (tx) => {
      await tx.usageBudget.delete({ where: { id: b.id } });
      await appendAuditEntry(tx, {
        workspaceId: b.workspaceId,
        actorId: req.user!.actorId,
        action: "BUDGET.DELETE",
        targetType: "UsageBudget",
        targetId: b.id,
        result: "SUCCESS",
      });
    }, AUDIT_TX_OPTIONS);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Model prices ---------------------------------------------------------------

router.get("/workspaces/:workspaceId/model-prices", requireAuth, requireWorkspaceMember, async (req, res, next) => {
  try {
    const prices = await prisma.modelPrice.findMany({ where: { workspaceId: req.ctx!.workspaceId }, orderBy: { model: "asc" } });
    res.json(prices.map((p) => ({ id: p.id, model: p.model, inputPerMTokUsd: p.inputPerMTokUsd.toFixed(2), outputPerMTokUsd: p.outputPerMTokUsd.toFixed(2) })));
  } catch (err) {
    next(err);
  }
});

router.put("/workspaces/:workspaceId/model-prices", requireAuth, requireWorkspaceAdmin, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        model: z.string().trim().min(1).max(100),
        inputPerMTokUsd: z.number().min(0).max(10_000),
        outputPerMTokUsd: z.number().min(0).max(10_000),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const workspaceId = req.ctx!.workspaceId;
    const { model, inputPerMTokUsd, outputPerMTokUsd } = parsed.data;
    const price = await prisma.$transaction(async (tx) => {
      const p = await tx.modelPrice.upsert({
        where: { workspaceId_model: { workspaceId, model } },
        create: { workspaceId, model, inputPerMTokUsd, outputPerMTokUsd },
        update: { inputPerMTokUsd, outputPerMTokUsd },
      });
      await appendAuditEntry(tx, {
        workspaceId,
        actorId: req.ctx!.actorId,
        action: "PRICE.SET",
        targetType: "ModelPrice",
        targetId: p.id,
        result: "SUCCESS",
        resource: `${model}: $${inputPerMTokUsd} in / $${outputPerMTokUsd} out per Mtok`,
      });
      return p;
    }, AUDIT_TX_OPTIONS);
    res.json({ id: price.id, model: price.model, inputPerMTokUsd: price.inputPerMTokUsd.toFixed(2), outputPerMTokUsd: price.outputPerMTokUsd.toFixed(2) });
  } catch (err) {
    next(err);
  }
});

router.delete("/workspaces/:workspaceId/model-prices/:priceId", requireAuth, requireWorkspaceAdmin, async (req, res, next) => {
  try {
    await prisma.modelPrice.deleteMany({ where: { id: req.params.priceId!, workspaceId: req.ctx!.workspaceId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Manual entries ---------------------------------------------------------------

// For clients that can't report_usage themselves: a human reads Claude Code's
// /cost (or a bill) and logs it against the agent and card.
router.post("/workspaces/:workspaceId/costs", requireAuth, requireWorkspaceAdmin, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        agentId: z.string().nullable().optional(),
        cardId: z.string().nullable().optional(),
        tokensIn: z.number().int().min(0).optional(),
        tokensOut: z.number().int().min(0).optional(),
        costUsd: z.number().min(0).max(100_000).nullable().optional(),
        model: z.string().max(100).nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      })
      .refine((v) => (v.tokensIn ?? 0) + (v.tokensOut ?? 0) > 0 || v.costUsd != null, { message: "Give tokens and/or costUsd" })
      .safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const workspaceId = req.ctx!.workspaceId;
    const d = parsed.data;
    const agent = d.agentId ? await prisma.agent.findFirst({ where: { id: d.agentId, workspaceId } }) : null;
    if (d.agentId && !agent) throw new ValidationError("Agent not in this workspace");
    if (d.cardId && !(await prisma.card.findFirst({ where: { id: d.cardId, workspaceId } }))) throw new ValidationError("Card not in this workspace");

    const result = await prisma.$transaction(async (tx) => {
      const r = await recordCost(tx, {
        workspaceId,
        actorId: agent?.actorId ?? req.ctx!.actorId,
        agentId: agent?.id ?? null,
        reportedByActorId: req.ctx!.actorId,
        source: "MANUAL",
        cardId: d.cardId ?? null,
        model: d.model ?? null,
        tokensIn: d.tokensIn ?? 0,
        tokensOut: d.tokensOut ?? 0,
        costUsd: d.costUsd ?? null,
        note: d.note ?? null,
      });
      await appendAuditEntry(tx, {
        workspaceId,
        actorId: req.ctx!.actorId,
        onBehalfOfActorId: null,
        action: "COST.LOG",
        targetType: d.cardId ? "Card" : "CostEvent",
        targetId: d.cardId ?? r.event.id,
        result: "SUCCESS",
        resource: `${r.event.tokensIn + r.event.tokensOut} tokens, $${r.event.costUsd?.toFixed(4) ?? "?"}${agent ? ` for agent ${agent.id}` : ""}`,
      });
      return r;
    }, AUDIT_TX_OPTIONS);
    res.status(201).json({ id: result.event.id, costUsd: result.event.costUsd?.toFixed(6) ?? null, budgets: result.notices });
  } catch (err) {
    next(err);
  }
});

export default router;
