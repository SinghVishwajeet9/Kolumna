// Phase 6 — when a card is "done". Done means "in the board's last column"
// (the rule sprint completion and epic progress already use). Every path that
// changes a card's column calls syncDone in the same transaction, so doneAt
// is always the moment it last arrived there, and doneAssigneeId is whose
// work it was at that moment.
//
// Leaving done is a REOPEN: doneAt clears, and a CARD.REOPEN audit entry
// records whose finished work it was. Agent reliability counts those.

import type { Tx } from "./audit.js";
import { appendAuditEntry } from "./audit.js";

export async function doneListId(tx: Tx, boardId: string) {
  const last = await tx.list.findFirst({ where: { boardId }, orderBy: { rank: "desc" }, select: { id: true } });
  return last?.id ?? null;
}

export async function syncDone(
  tx: Tx,
  cardId: string,
  by: { actorId: string; onBehalfOfActorId?: string | null },
) {
  const card = await tx.card.findUniqueOrThrow({
    where: { id: cardId },
    select: { id: true, workspaceId: true, boardId: true, listId: true, doneAt: true, doneAssigneeId: true, assigneeId: true },
  });
  const isDone = card.listId === (await doneListId(tx, card.boardId));

  if (isDone && !card.doneAt) {
    await tx.card.update({ where: { id: card.id }, data: { doneAt: new Date(), doneAssigneeId: card.assigneeId } });
  } else if (!isDone && card.doneAt) {
    await tx.card.update({ where: { id: card.id }, data: { doneAt: null, doneAssigneeId: null } });
    await appendAuditEntry(tx, {
      workspaceId: card.workspaceId,
      actorId: by.actorId,
      onBehalfOfActorId: by.onBehalfOfActorId ?? null,
      action: "CARD.REOPEN",
      targetType: "Card",
      targetId: card.id,
      result: "SUCCESS",
      // Whose finished work was reopened — reliability is computed from this.
      resource: card.doneAssigneeId ?? "unassigned",
    });
  }
  return isDone;
}
