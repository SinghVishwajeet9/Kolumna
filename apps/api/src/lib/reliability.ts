// Phase 6 — an agent's track record, and what it suggests about its autonomy.
//
// Measured from facts Kolumna already records, not from what the agent says:
//   approval rate  — of its gated changes and plans a human decided, how many
//                    were approved (FAILED reviews don't count either way)
//   reopen rate    — of the cards it finished, how many were later reopened
//                    (CARD.REOPEN audit entries naming it as the finisher)
//   calibration    — its average stated confidence, next to that approval rate
//   denials        — tool calls refused by policy, out of all its calls
//   throughput     — cards and points it finished; cost from Phase 5
//
// The system SUGGESTS promotion/demotion; a human always grants it
// (architecture §7).

import type { Tx } from "./audit.js";
import type { prisma as Prisma } from "./prisma.js";

type Db = Tx | typeof Prisma;

export type Reliability = {
  cardsDone: number;
  pointsDone: number;
  reopened: number;
  reviewsDecided: number;
  reviewsApproved: number;
  approvalRate: number | null;
  reopenRate: number | null;
  avgConfidence: number | null;
  deniedCalls: number;
  toolCalls: number;
  costUsd: string | null;
};

// Either a window ("the last 30 days") or one sprint.
export type Scope = { since: Date } | { sprintId: string; from: Date; to: Date };

export async function computeReliability(
  db: Db,
  agent: { id: string; actorId: string; workspaceId: string },
  scope: Scope,
): Promise<Reliability> {
  const bySprint = "sprintId" in scope;
  const when = bySprint ? { gte: scope.from, lte: scope.to } : { gte: scope.since };
  const cardScope = bySprint ? { sprintId: scope.sprintId } : {};

  const [done, reopened, reviews, proposals, calls, denied, cost] = await Promise.all([
    db.card.findMany({
      where: { workspaceId: agent.workspaceId, doneAssigneeId: agent.actorId, doneAt: bySprint ? { not: null } : when, ...cardScope },
      select: { storyPoints: true },
    }),
    db.auditEntry.count({
      where: {
        workspaceId: agent.workspaceId,
        action: "CARD.REOPEN",
        resource: agent.actorId,
        ...(bySprint ? { createdAt: when } : { createdAt: when }),
      },
    }),
    db.confidenceReview.findMany({
      where: { agentId: agent.id, status: { in: ["APPROVED", "REJECTED"] }, decidedAt: when, ...(bySprint ? { card: { sprintId: scope.sprintId } } : {}) },
      select: { status: true, confidence: true },
    }),
    db.subtaskProposal.findMany({
      where: { proposedByActorId: agent.actorId, status: { in: ["APPROVED", "REJECTED"] }, reviewedAt: when, ...(bySprint ? { card: { sprintId: scope.sprintId } } : {}) },
      select: { status: true },
    }),
    db.auditEntry.count({ where: { workspaceId: agent.workspaceId, actorId: agent.actorId, toolInvoked: { not: null }, createdAt: when } }),
    db.auditEntry.count({ where: { workspaceId: agent.workspaceId, actorId: agent.actorId, result: "DENIED", createdAt: when } }),
    db.costEvent.aggregate({
      where: { agentId: agent.id, ...(bySprint ? { sprintId: scope.sprintId } : { createdAt: when }) },
      _sum: { costUsd: true },
    }),
  ]);

  const decided = [...reviews, ...proposals];
  const approved = decided.filter((r) => r.status === "APPROVED").length;
  const confidences = reviews.map((r) => r.confidence).filter((c): c is number => c !== null);
  return {
    cardsDone: done.length,
    pointsDone: done.reduce((n, c) => n + (c.storyPoints ?? 0), 0),
    reopened,
    reviewsDecided: decided.length,
    reviewsApproved: approved,
    approvalRate: decided.length ? approved / decided.length : null,
    // Reopens can outnumber cards finished in a window (old work reopened now) — cap at 1.
    reopenRate: done.length ? Math.min(1, reopened / done.length) : reopened ? 1 : null,
    avgConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
    deniedCalls: denied,
    toolCalls: calls,
    costUsd: cost._sum.costUsd?.toFixed(6) ?? null,
  };
}

type Level = "SUGGEST_ONLY" | "ACT_WITH_APPROVAL" | "ACT_AUTONOMOUS";
const ORDER: Level[] = ["SUGGEST_ONLY", "ACT_WITH_APPROVAL", "ACT_AUTONOMOUS"];

// Deliberately conservative thresholds: promotion needs real history.
export const PROMOTE = { minDecided: 10, minApproval: 0.9, minCardsDone: 3, maxReopen: 0.1 };
export const DEMOTE = { minDecided: 5, maxApproval: 0.5, minCardsDone: 3, minReopen: 0.3 };

export type Suggestion =
  | { kind: "PROMOTE" | "DEMOTE"; to: Level; because: string }
  | { kind: "NONE"; because: string };

export function suggestAutonomy(level: Level, r: Reliability): Suggestion {
  const i = ORDER.indexOf(level);
  const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

  const poorApproval = r.reviewsDecided >= DEMOTE.minDecided && (r.approvalRate ?? 1) < DEMOTE.maxApproval;
  const poorRework = r.cardsDone >= DEMOTE.minCardsDone && (r.reopenRate ?? 0) >= DEMOTE.minReopen;
  if (i > 0 && (poorApproval || poorRework)) {
    return {
      kind: "DEMOTE",
      to: ORDER[i - 1]!,
      because: poorApproval
        ? `only ${pct(r.approvalRate)} of ${r.reviewsDecided} decided changes were approved`
        : `${pct(r.reopenRate)} of the ${r.cardsDone} cards it finished were reopened`,
    };
  }

  if (i < ORDER.length - 1) {
    const missing: string[] = [];
    if (r.reviewsDecided < PROMOTE.minDecided) missing.push(`${PROMOTE.minDecided - r.reviewsDecided} more decided changes`);
    if (r.cardsDone < PROMOTE.minCardsDone) missing.push(`${PROMOTE.minCardsDone - r.cardsDone} more finished cards`);
    if (missing.length) return { kind: "NONE", because: `needs more history: ${missing.join(", ")}` };
    if ((r.approvalRate ?? 0) >= PROMOTE.minApproval && (r.reopenRate ?? 0) <= PROMOTE.maxReopen) {
      return {
        kind: "PROMOTE",
        to: ORDER[i + 1]!,
        because: `${pct(r.approvalRate)} of ${r.reviewsDecided} decided changes approved, ${pct(r.reopenRate)} reopened`,
      };
    }
    return { kind: "NONE", because: `approval ${pct(r.approvalRate)} and reopen rate ${pct(r.reopenRate)} don't clear the bar yet` };
  }
  return { kind: "NONE", because: "already autonomous; no problems in its record" };
}
