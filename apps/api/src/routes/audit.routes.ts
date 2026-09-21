// Read side of the audit trail. This IS the "explain your work" panel from
// kolumna-architecture.md §4.2 — a query over AuditEntry for one target, plus
// a whole-workspace log and a tamper-evidence check. No new tables, no new
// write path — this only ever reads what agent.routes.ts / card.routes.ts /
// board.routes.ts / list.routes.ts already wrote.

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../middleware/requireWorkspaceMember.js";
import { getLineageForTarget, listAuditLog, verifyChain } from "../lib/audit.js";

const router = Router();

function serializeEntry(entry: {
  id: string;
  seq: number;
  actorId: string;
  actor: { displayName: string; type: string };
  onBehalfOfActorId: string | null;
  onBehalfOf: { displayName: string } | null;
  action: string;
  targetType: string;
  targetId: string;
  result: string;
  reasoningSummary: string | null;
  confidence: number | null;
  costUsd: number | null;
  hash: string;
  prevHash: string;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    seq: entry.seq,
    actor: { id: entry.actorId, displayName: entry.actor.displayName, type: entry.actor.type },
    onBehalfOf: entry.onBehalfOf
      ? { id: entry.onBehalfOfActorId, displayName: entry.onBehalfOf.displayName }
      : null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    result: entry.result,
    reasoningSummary: entry.reasoningSummary,
    confidence: entry.confidence,
    costUsd: entry.costUsd,
    hash: entry.hash,
    prevHash: entry.prevHash,
    createdAt: entry.createdAt,
  };
}

router.get(
  "/workspaces/:workspaceId/audit",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const entries = await listAuditLog(req.ctx!.workspaceId);
      res.json(entries.map(serializeEntry));
    } catch (err) {
      next(err);
    }
  },
);

// The tamper-evidence proof itself — recomputes every hash and confirms the
// chain holds. Cheap enough to run on demand at this scale; a real
// deployment would also run this periodically/on schedule.
router.get(
  "/workspaces/:workspaceId/audit/verify",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const result = await verifyChain(req.ctx!.workspaceId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// "Explain your work": full lineage for one target (a Card, an Agent, ...).
router.get(
  "/workspaces/:workspaceId/audit/:targetType/:targetId",
  requireAuth,
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const entries = await getLineageForTarget(
        req.ctx!.workspaceId,
        req.params.targetType!,
        req.params.targetId!,
      );
      res.json(entries.map(serializeEntry));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
