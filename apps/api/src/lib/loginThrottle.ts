// Login rate limiting (roadmap G10): stops password guessing.
//
// Keyed by EMAIL, not IP. Once hosted, every request reaches the API through
// the web app's /api pass-through, so the address the API sees is the
// proxy's, shared by every user. An IP limit would put all users in one
// bucket (one attacker locks everyone out) until the forwarded-for chain is
// verified on the real hosts. A per-email limit protects each account
// regardless of where the guesses come from.
//
// Rules:
//   - 5 failed logins for an email within 15 minutes lock that email until
//     the oldest of those 5 is 15 minutes old.
//   - While locked, even the right password is refused (429), so an attacker
//     learns nothing from guesses made during the lock.
//   - A successful login clears that email's failures.
//   - Failures count whether or not the account exists, so the lock doesn't
//     reveal which emails are registered.
//
// Known limits: two guesses landing at the same instant can both slip in
// (a 6th attempt at worst); and anyone can lock a victim's account for 15
// minutes by failing on purpose. That trade-off is why the window is short.

import { prisma } from "./prisma.js";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
const KEEP_MS = 24 * 60 * 60_000;

export function throttleKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Milliseconds until this email may try again, or 0 if it isn't locked. */
export async function lockedForMs(email: string, now = Date.now()): Promise<number> {
  const recent = await prisma.loginFailure.findMany({
    where: { email: throttleKey(email), createdAt: { gt: new Date(now - WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: MAX_FAILURES,
    select: { createdAt: true },
  });
  if (recent.length < MAX_FAILURES) return 0;
  // Unlocks when the oldest of the last MAX_FAILURES leaves the window.
  return Math.max(0, recent[MAX_FAILURES - 1]!.createdAt.getTime() + WINDOW_MS - now);
}

export async function recordFailure(email: string): Promise<void> {
  await prisma.$transaction([
    prisma.loginFailure.create({ data: { email: throttleKey(email) } }),
    // Housekeeping, so the table can't grow forever.
    prisma.loginFailure.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } }),
  ]);
}

export async function clearFailures(email: string): Promise<void> {
  await prisma.loginFailure.deleteMany({ where: { email: throttleKey(email) } });
}
