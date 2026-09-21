// The hash-chained, append-only audit log — kolumna-architecture.md §4.2,
// the platform's #1 differentiator. Shared between core-api (human-attributed
// mutations: board/list/card CRUD) and the agent gateway (agent lifecycle),
// per the design principle that governance lives next to the ticket, not in
// a separate product.
//
// Each entry's hash commits to the PREVIOUS entry's hash — a Merkle-style
// chain, same idea as a blockchain/git commit graph: change or delete an old
// entry and every hash after it stops matching, so tampering is detectable,
// not just theoretically forbidden. See verifyChain() below, which is
// exactly what an "explain your work" panel or a compliance audit would run.

import { createHash } from "node:crypto";
import { prisma } from "./prisma.js";

export const GENESIS_HASH = "0".repeat(64);

export type AuditResult = "SUCCESS" | "DENIED" | "PENDING_APPROVAL" | "ERROR";

export type AuditEntryInput = {
  workspaceId: string;
  actorId: string;
  onBehalfOfActorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  result: AuditResult;
  toolInvoked?: string | null;
  resource?: string | null;
  reasoningSummary?: string | null;
  confidence?: number | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd?: number | null;
};

// The exact set of fields committed to by the hash, with a stable key order
// and every optional field normalized to `null` (never `undefined` —
// JSON.stringify silently drops undefined keys, which would make the hash
// depend on which optional fields the CALLER happened to pass rather than on
// the actual entry content).
function canonicalize(entry: {
  workspaceId: string;
  seq: number;
  actorId: string;
  onBehalfOfActorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  toolInvoked: string | null;
  resource: string | null;
  result: string;
  reasoningSummary: string | null;
  confidence: number | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  prevHash: string;
  createdAt: string;
}): string {
  return JSON.stringify({
    workspaceId: entry.workspaceId,
    seq: entry.seq,
    actorId: entry.actorId,
    onBehalfOfActorId: entry.onBehalfOfActorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    toolInvoked: entry.toolInvoked,
    resource: entry.resource,
    result: entry.result,
    reasoningSummary: entry.reasoningSummary,
    confidence: entry.confidence,
    model: entry.model,
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    costUsd: entry.costUsd,
    prevHash: entry.prevHash,
    createdAt: entry.createdAt,
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// NOTE: reads the latest seq/hash and writes the next one inside a single
// transaction — correct under this app's realistic write volume, but not
// safe against two truly concurrent writers racing on the same workspace (a
// unique constraint on (workspaceId, seq) means a race fails loudly rather
// than corrupting the chain, but it isn't retried here). A real production
// version would serialize this with a per-workspace advisory lock. Named as
// a known simplification, not an oversight — see PHASE_2.md.
export async function writeAuditEntry(input: AuditEntryInput) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.auditEntry.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { seq: "desc" },
    });

    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS_HASH;
    const createdAt = new Date();

    const normalized = {
      workspaceId: input.workspaceId,
      seq,
      actorId: input.actorId,
      onBehalfOfActorId: input.onBehalfOfActorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      toolInvoked: input.toolInvoked ?? null,
      resource: input.resource ?? null,
      result: input.result,
      reasoningSummary: input.reasoningSummary ?? null,
      confidence: input.confidence ?? null,
      model: input.model ?? null,
      tokensIn: input.tokensIn ?? null,
      tokensOut: input.tokensOut ?? null,
      costUsd: input.costUsd ?? null,
      prevHash,
      createdAt: createdAt.toISOString(),
    };

    const hash = sha256(prevHash + canonicalize(normalized));

    return tx.auditEntry.create({
      data: { ...normalized, createdAt, hash },
    });
  });
}

/** Reconstructs lineage for one target — the query an "explain your work"
 * panel runs. Oldest first, so it reads as a timeline. */
export async function getLineageForTarget(
  workspaceId: string,
  targetType: string,
  targetId: string,
) {
  return prisma.auditEntry.findMany({
    where: { workspaceId, targetType, targetId },
    include: { actor: true, onBehalfOf: true },
    orderBy: { seq: "asc" },
  });
}

export async function listAuditLog(workspaceId: string) {
  return prisma.auditEntry.findMany({
    where: { workspaceId },
    include: { actor: true, onBehalfOf: true },
    orderBy: { seq: "asc" },
  });
}

export type ChainVerification =
  | { valid: true; entriesChecked: number }
  | { valid: false; brokenAtSeq: number; reason: "prevHash mismatch" | "hash mismatch" };

/** Recomputes every hash from scratch and confirms the chain holds — the
 * tamper-evidence proof itself, not just a claim of it. Any edit, deletion,
 * or reordering of a past entry is caught here. */
export async function verifyChain(workspaceId: string): Promise<ChainVerification> {
  const entries = await prisma.auditEntry.findMany({
    where: { workspaceId },
    orderBy: { seq: "asc" },
  });

  let expectedPrev = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== expectedPrev) {
      return { valid: false, brokenAtSeq: entry.seq, reason: "prevHash mismatch" };
    }

    const recomputed = sha256(
      entry.prevHash +
        canonicalize({
          workspaceId: entry.workspaceId,
          seq: entry.seq,
          actorId: entry.actorId,
          onBehalfOfActorId: entry.onBehalfOfActorId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          toolInvoked: entry.toolInvoked,
          resource: entry.resource,
          result: entry.result,
          reasoningSummary: entry.reasoningSummary,
          confidence: entry.confidence,
          model: entry.model,
          tokensIn: entry.tokensIn,
          tokensOut: entry.tokensOut,
          costUsd: entry.costUsd,
          prevHash: entry.prevHash,
          createdAt: entry.createdAt.toISOString(),
        }),
    );

    if (recomputed !== entry.hash) {
      return { valid: false, brokenAtSeq: entry.seq, reason: "hash mismatch" };
    }

    expectedPrev = entry.hash;
  }

  return { valid: true, entriesChecked: entries.length };
}
