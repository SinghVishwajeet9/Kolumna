// Phase 4 — graduated trust. Decides, for one gated tool call, whether the
// agent may act now or the action must wait for a human (a ConfidenceReview).
//
//   SUGGEST_ONLY       every gated write waits for a human
//   ACT_WITH_APPROVAL  acts only when its stated confidence ≥ the threshold;
//                      otherwise (or with no confidence given) it waits
//   ACT_AUTONOMOUS     acts directly — still audited, and a card a human has
//                      marked with a reviewThreshold still gates below it
//
// The level is per agent, overridable per board (AutonomyPolicy). The
// threshold is the stricter of the agent's/policy's and the card's own.

import type { Tx } from "../lib/audit.js";

type Level = "SUGGEST_ONLY" | "ACT_WITH_APPROVAL" | "ACT_AUTONOMOUS";

export type AutonomyDecision =
  | { kind: "ALLOW"; level: Level; threshold: number | null }
  | { kind: "REVIEW"; reason: "AUTONOMY_LEVEL" | "LOW_CONFIDENCE"; level: Level; threshold: number | null; why: string };

export async function decideAutonomy(
  tx: Tx,
  params: {
    // The agent's own defaults — already loaded with its grant, so no query.
    agent: { id: string; autonomyLevel: Level; confidenceThreshold: number };
    boardId: string;
    cardId: string | null;
    confidence: number | null;
  },
): Promise<AutonomyDecision> {
  const { agent, confidence } = params;
  // One round trip: the board's policy for this agent, and the card's own bar.
  const policyWhere = { agentId: agent.id, boardId: params.boardId };
  const [policy, cardThreshold] = params.cardId
    ? await tx.card
        .findUnique({
          where: { id: params.cardId },
          select: { reviewThreshold: true, board: { select: { autonomyPolicies: { where: policyWhere } } } },
        })
        .then((c) => [c?.board.autonomyPolicies[0] ?? null, c?.reviewThreshold ?? null] as const)
    : [await tx.autonomyPolicy.findFirst({ where: policyWhere }), null] as const;

  const level = policy?.level ?? agent.autonomyLevel;

  if (level === "SUGGEST_ONLY") {
    return { kind: "REVIEW", reason: "AUTONOMY_LEVEL", level, threshold: null, why: "this agent may only suggest changes here" };
  }

  // The bar it must clear: autonomous agents only answer to a card's own
  // threshold; agents acting with approval answer to the stricter of theirs
  // and the card's.
  const threshold =
    level === "ACT_AUTONOMOUS"
      ? cardThreshold
      : Math.max(policy?.confidenceThreshold ?? agent.confidenceThreshold, cardThreshold ?? 0);

  if (threshold === null || threshold <= 0) return { kind: "ALLOW", level, threshold };
  if (confidence === null) {
    return { kind: "REVIEW", reason: "LOW_CONFIDENCE", level, threshold, why: `no confidence given (needs ≥ ${pct(threshold)})` };
  }
  if (confidence >= threshold) return { kind: "ALLOW", level, threshold };
  return {
    kind: "REVIEW",
    reason: "LOW_CONFIDENCE",
    level,
    threshold,
    why: `confidence ${pct(confidence)} is below ${pct(threshold)}`,
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
