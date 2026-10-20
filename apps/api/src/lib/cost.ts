// Phase 5 — cost accounting. Records spend (CostEvent), prices token counts
// with the workspace's own model prices, and keeps budgets' alert/exceeded
// state current. Money is Prisma.Decimal end to end; it only becomes a number
// (or string) at the API boundary.

import { Prisma } from "../generated/prisma/client.js";
import type { Tx } from "./audit.js";
import { appendAuditEntry } from "./audit.js";

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const MTOK = D(1_000_000);

export function startOfMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Price token counts with the workspace's table; null if the model isn't priced. */
export async function priceTokens(tx: Tx, workspaceId: string, model: string | null, tokensIn: number, tokensOut: number) {
  if (!model) return null;
  const price = await tx.modelPrice.findUnique({ where: { workspaceId_model: { workspaceId, model } } });
  if (!price) return null;
  return price.inputPerMTokUsd.mul(tokensIn).div(MTOK).add(price.outputPerMTokUsd.mul(tokensOut).div(MTOK)).toDecimalPlaces(6);
}

export type CostInput = {
  workspaceId: string;
  actorId: string;
  agentId: string | null;
  reportedByActorId: string;
  source: "SELF_REPORTED" | "HOSTED_RUN" | "MANUAL";
  cardId: string | null;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null; // as stated; null → priced from the model table if possible
  note: string | null;
};

/**
 * Write one cost event (with the card's board/sprint/epic snapshotted), then
 * re-evaluate every budget it counts against. Returns the event and any
 * budget that is now over its alert line or cap, for the caller to surface.
 */
export async function recordCost(tx: Tx, input: CostInput) {
  const card = input.cardId
    ? await tx.card.findUnique({ where: { id: input.cardId }, select: { boardId: true, sprintId: true, epicId: true } })
    : null;
  const costUsd =
    input.costUsd !== null
      ? D(input.costUsd).toDecimalPlaces(6)
      : await priceTokens(tx, input.workspaceId, input.model, input.tokensIn, input.tokensOut);

  const event = await tx.costEvent.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      actorId: input.actorId,
      reportedByActorId: input.reportedByActorId,
      source: input.source,
      cardId: input.cardId,
      boardId: card?.boardId ?? null,
      sprintId: card?.sprintId ?? null,
      epicId: card?.epicId ?? null,
      model: input.model,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      costUsd,
      note: input.note,
    },
  });

  const budgets = await tx.usageBudget.findMany({
    where: {
      workspaceId: input.workspaceId,
      OR: [
        { sprintId: null, agentId: null },
        ...(input.agentId ? [{ sprintId: null, agentId: input.agentId }] : []),
        ...(event.sprintId ? [{ sprintId: event.sprintId }] : []),
      ],
    },
  });
  const notices: BudgetStatus[] = [];
  for (const b of budgets) {
    const status = await refreshBudget(tx, b, input.reportedByActorId);
    if (status.state !== "OK") notices.push(status);
  }
  return { event, notices };
}

type BudgetRow = Awaited<ReturnType<Tx["usageBudget"]["findFirstOrThrow"]>>;

export type BudgetStatus = {
  budgetId: string;
  scope: string;
  spentUsd: string;
  spentTokens: number;
  costCapUsd: string | null;
  tokenCap: number | null;
  fraction: number; // the larger of cost/cap and tokens/cap
  state: "OK" | "ALERT" | "EXCEEDED";
};

/** Spend that counts against this budget in its current period. */
export async function budgetSpend(tx: Tx, b: BudgetRow) {
  const where: Prisma.CostEventWhereInput = b.sprintId
    ? { sprintId: b.sprintId }
    : { workspaceId: b.workspaceId, createdAt: { gte: startOfMonth() }, ...(b.agentId ? { agentId: b.agentId } : {}) };
  const agg = await tx.costEvent.aggregate({ where, _sum: { costUsd: true, tokensIn: true, tokensOut: true } });
  return {
    usd: agg._sum.costUsd ?? D(0),
    tokens: (agg._sum.tokensIn ?? 0) + (agg._sum.tokensOut ?? 0),
  };
}

function scopeLabel(b: BudgetRow) {
  return b.sprintId ? "sprint" : b.agentId ? "agent / month" : "workspace / month";
}

/**
 * Recompute a budget's state and record transitions exactly once:
 * crossing alertAt → BUDGET.ALERT; crossing the cap → BUDGET.EXCEEDED; back
 * under (cap raised, new month) → the flags clear.
 */
export async function refreshBudget(tx: Tx, b: BudgetRow, actorId: string): Promise<BudgetStatus> {
  const spent = await budgetSpend(tx, b);
  const costFrac = b.costCapUsd && b.costCapUsd.gt(0) ? spent.usd.div(b.costCapUsd).toNumber() : 0;
  const tokenFrac = b.tokenCap && b.tokenCap > 0 ? spent.tokens / b.tokenCap : 0;
  const fraction = Math.max(costFrac, tokenFrac);
  const state: BudgetStatus["state"] = fraction >= 1 ? "EXCEEDED" : fraction >= b.alertAt ? "ALERT" : "OK";

  // Monthly budgets start fresh each month: a flag from last month doesn't count.
  const periodStart = b.sprintId ? new Date(0) : startOfMonth();
  const alerted = b.alertedAt && b.alertedAt >= periodStart;
  const exceeded = b.exceededAt && b.exceededAt >= periodStart;
  const now = new Date();
  const data: Prisma.UsageBudgetUpdateInput = {};
  if (state !== "OK" && !alerted) data.alertedAt = now;
  if (state === "EXCEEDED" && !exceeded) data.exceededAt = now;
  if (state !== "EXCEEDED" && b.exceededAt) data.exceededAt = null;
  if (state === "OK" && b.alertedAt) data.alertedAt = null;
  if (Object.keys(data).length) await tx.usageBudget.update({ where: { id: b.id }, data });

  const status: BudgetStatus = {
    budgetId: b.id,
    scope: scopeLabel(b),
    spentUsd: spent.usd.toFixed(2),
    spentTokens: spent.tokens,
    costCapUsd: b.costCapUsd?.toFixed(2) ?? null,
    tokenCap: b.tokenCap,
    fraction,
    state,
  };
  for (const [flag, action] of [
    ["alertedAt", "BUDGET.ALERT"],
    ["exceededAt", "BUDGET.EXCEEDED"],
  ] as const) {
    if (data[flag] instanceof Date) {
      await appendAuditEntry(tx, {
        workspaceId: b.workspaceId,
        actorId,
        action,
        targetType: "UsageBudget",
        targetId: b.id,
        result: "SUCCESS",
        resource: `${scopeLabel(b)}: $${status.spentUsd}${status.costCapUsd ? ` of $${status.costCapUsd}` : ""}, ${status.spentTokens} tokens${b.tokenCap ? ` of ${b.tokenCap}` : ""}`,
      });
    }
  }
  return status;
}

/**
 * Phase 5's hook into the autonomy gate: is a budget covering this agent's
 * change used up? Returns a reason, or null. One query.
 */
export async function exhaustedBudget(tx: Tx, p: { workspaceId: string; agentId: string; sprintId: string | null }) {
  const hit = await tx.usageBudget.findFirst({
    where: {
      workspaceId: p.workspaceId,
      exceededAt: { not: null },
      OR: [
        { sprintId: null, agentId: null, exceededAt: { gte: startOfMonth() } },
        { sprintId: null, agentId: p.agentId, exceededAt: { gte: startOfMonth() } },
        ...(p.sprintId ? [{ sprintId: p.sprintId }] : []),
      ],
    },
  });
  return hit ? `the ${scopeLabel(hit)} budget is used up` : null;
}
