// Card keys like "PRM-3": a per-board prefix plus a per-board number.
// boardKeyFromTitle() must match the backfill rule in migration
// 20261020122107_sprints_epics_keys, so old and new boards get keys the
// same way.

import type { Tx } from "./audit.js";

export function boardKeyFromTitle(title: string): string {
  const words = title
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0]!)
      .join("")
      .toUpperCase();
  }
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  return "B";
}

// "PRM", or "PRM2", "PRM3"… if the workspace already has that key.
export async function uniqueBoardKey(tx: Tx, workspaceId: string, title: string) {
  const base = boardKeyFromTitle(title);
  const taken = new Set(
    (
      await tx.board.findMany({
        where: { workspaceId, key: { startsWith: base } },
        select: { key: true },
      })
    ).map((b) => b.key),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}

// Hands out the next card number for a board. The increment and the read
// happen in ONE UPDATE statement, so two concurrent creates can never get
// the same number (the row lock serializes them).
export async function allocateCardNumber(tx: Tx, boardId: string) {
  const board = await tx.board.update({
    where: { id: boardId },
    data: { nextCardNumber: { increment: 1 } },
    select: { nextCardNumber: true },
  });
  return board.nextCardNumber - 1;
}
