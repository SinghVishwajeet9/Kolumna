// Fractional ranking — see ARCHITECTURE.md §6, Decision 2 and
// CONCEPTS.md Part 6. Instead of integer positions (which need renumbering
// every row after a move — O(n) writes, and racy under concurrent drags),
// we store a float and insert at the MIDPOINT between neighbors. One row
// changes per move, always, regardless of list size.
//
// The client sends neighbor IDs, never a rank — this function is what the
// SERVER uses to turn "drop it between card A and card B" into an actual
// number. Never trust a rank value from the client directly.

export function calculateRank(beforeRank: number | null, afterRank: number | null): number {
  if (beforeRank === null && afterRank === null) {
    // Empty list — first card ever.
    return 1.0;
  }
  if (beforeRank === null) {
    // Dropped at the very start — half of whatever comes after.
    return afterRank! / 2;
  }
  if (afterRank === null) {
    // Dropped at the very end — one more than whatever comes before.
    return beforeRank + 1;
  }
  // Dropped between two existing cards — the midpoint.
  return (beforeRank + afterRank) / 2;
}
