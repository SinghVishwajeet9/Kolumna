// Phase 4 — the human side of a ConfidenceReview. When a human approves, the
// queued tool call runs NOW, as the agent, on the approver's authority — and
// everything that could have changed since it was queued is checked again:
// the agent may have been suspended, lost the scope, or reached the end of
// its access; the card may have been reassigned or deleted (the handler's own
// checks catch those).

import { prisma } from "../lib/prisma.js";
import { appendAuditEntry, writeAuditEntry, AUDIT_TX_OPTIONS } from "../lib/audit.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { accessEnd } from "./agentGrant.repo.js";
import { parseScopes } from "./scopes.js";
import { tools, ToolError } from "./tools.js";

export async function findReview(actorId: string, reviewId: string) {
  const review = await prisma.confidenceReview.findFirst({
    where: { id: reviewId, workspace: { members: { some: { actorId } } } },
  });
  if (!review) throw new NotFoundError("Review not found");
  return review;
}

export async function approveReview(reviewId: string, reviewerActorId: string) {
  const review = await prisma.confidenceReview.findUniqueOrThrow({ where: { id: reviewId } });
  if (review.status !== "PENDING") throw new ConflictError("This review is no longer pending");
  const tool = tools.find((t) => t.name === review.toolName);

  try {
    return await prisma.$transaction(async (tx) => {
      // Conditional flip = "still pending?" and the state change in one step,
      // so two reviewers clicking at once can't both run the action.
      const flipped = await tx.confidenceReview.updateMany({
        where: { id: review.id, status: "PENDING" },
        data: { status: "APPROVED", reviewerActorId, decidedAt: new Date() },
      });
      if (flipped.count === 0) throw new ConflictError("This review is no longer pending");

      if (!tool) throw new ToolError("UNKNOWN_TOOL", `Tool "${review.toolName}" no longer exists`);
      const agent = await tx.agent.findUniqueOrThrow({
        where: { id: review.agentId },
        include: { accessSprint: { select: { name: true, status: true, completedAt: true } } },
      });
      if (agent.status !== "ACTIVE") throw new ToolError("AGENT_INACTIVE", `Agent is ${agent.status}`);
      const end = accessEnd(agent);
      if (end && end.at.getTime() <= Date.now()) throw new ToolError("GRANT_INVALID", `Agent access has ended: ${end.reason}`);
      if (!parseScopes(agent.allowedScopes).includes(tool.requiredScope)) {
        throw new ToolError("FORBIDDEN", `Agent no longer has scope "${tool.requiredScope}"`);
      }

      const input = tool.input.parse(review.input);
      const outcome = await tool.handler(input, {
        workspaceId: review.workspaceId,
        agentId: agent.id,
        actorId: agent.actorId,
        runId: null,
        onBehalfOfActorId: reviewerActorId, // it lands on the approver's authority
        tx,
      });
      if (outcome.audit) {
        await appendAuditEntry(tx, {
          workspaceId: review.workspaceId,
          actorId: agent.actorId,
          onBehalfOfActorId: reviewerActorId,
          action: tool.auditAction,
          toolInvoked: tool.name,
          targetType: outcome.audit.targetType,
          targetId: outcome.audit.targetId,
          result: "SUCCESS",
          resource: [outcome.audit.resource, `approved review ${review.id}`].filter(Boolean).join("; "),
          reasoningSummary: review.reasoning,
          confidence: review.confidence,
        });
      }
      await tx.confidenceReview.update({
        where: { id: review.id },
        data: { result: (outcome.output ?? null) as never },
      });
      await appendAuditEntry(tx, {
        workspaceId: review.workspaceId,
        actorId: reviewerActorId,
        action: "REVIEW.APPROVE",
        targetType: review.cardId ? "Card" : "Board",
        targetId: review.cardId ?? review.boardId,
        result: "SUCCESS",
        resource: `${review.id}: ${review.summary}`.slice(0, 500),
      });
      return { reviewId: review.id, status: "APPROVED" as const, output: outcome.output };
    }, AUDIT_TX_OPTIONS);
  } catch (err) {
    if (!(err instanceof ToolError)) throw err;
    // The action can't run any more (e.g. the card was reassigned). Record
    // that, so the agent and the reviewer both see why.
    await prisma.confidenceReview.updateMany({
      where: { id: review.id, status: "PENDING" },
      data: { status: "FAILED", reviewerActorId, decidedAt: new Date(), error: `${err.code}: ${err.message}` },
    });
    await writeAuditEntry({
      workspaceId: review.workspaceId,
      actorId: reviewerActorId,
      action: "REVIEW.APPROVE",
      targetType: review.cardId ? "Card" : "Board",
      targetId: review.cardId ?? review.boardId,
      result: "ERROR",
      resource: `${review.id}: ${err.code}: ${err.message}`.slice(0, 500),
    });
    throw new ConflictError(`Couldn't apply it: ${err.message}`);
  }
}

export async function rejectReview(reviewId: string, reviewerActorId: string, note: string | null) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.confidenceReview.findUniqueOrThrow({ where: { id: reviewId } });
    const flipped = await tx.confidenceReview.updateMany({
      where: { id: reviewId, status: "PENDING" },
      data: { status: "REJECTED", reviewerActorId, decidedAt: new Date(), note },
    });
    if (flipped.count === 0) throw new ConflictError("This review is no longer pending");
    await appendAuditEntry(tx, {
      workspaceId: review.workspaceId,
      actorId: reviewerActorId,
      action: "REVIEW.REJECT",
      targetType: review.cardId ? "Card" : "Board",
      targetId: review.cardId ?? review.boardId,
      result: "SUCCESS",
      resource: `${review.id}: ${review.summary}${note ? ` (note: ${note})` : ""}`.slice(0, 500),
    });
    return { reviewId, status: "REJECTED" as const };
  }, AUDIT_TX_OPTIONS);
}
