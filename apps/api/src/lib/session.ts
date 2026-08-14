// Hand-rolled sessions. See ARCHITECTURE.md §6, Decision 4 and
// CONCEPTS.md §5.4-5.5 for why sessions over JWT, and why hand-rolled.
//
// The core idea: the browser and the database NEVER hold the same secret.
//   1. generateSessionToken() makes a random string — this is what goes in
//      the browser's cookie. Nothing else ever sees it.
//   2. Before touching the database, we hash that token (SHA-256) and use
//      the hash as the session's row ID. The raw token is never stored
//      anywhere. If the database leaks, the attacker has hashes — useless
//      for logging in, since hashing is one-way (CONCEPTS.md §5.2).
//   3. To validate a request, hash the incoming cookie the same way and
//      look up that hash. Match + not expired => this is a real session.

import { randomBytes, createHash } from "node:crypto";
import type { Response } from "express";
import { prisma } from "./prisma.js";

export const SESSION_COOKIE_NAME = "kolumna_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
// If a session has less than this much life left when it's used, we push
// its expiry back out — an active user never gets logged out mid-session,
// but an abandoned session still dies on schedule. This is a "sliding
// window" expiration.
const RENEWAL_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

/** A cryptographically random, URL-safe string. This is the secret the
 * browser holds. 20 bytes of real randomness — not guessable. */
export function generateSessionToken(): string {
  return randomBytes(20).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a session row and returns its expiry (for setting the cookie). */
export async function createSession(token: string, userId: string) {
  const session = await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return session;
}

/** Given a raw token from a cookie, returns the logged-in user, or null if
 * the token doesn't match a live session. Also handles expiry and sliding
 * renewal — callers don't need to think about either. */
export async function validateSessionToken(token: string) {
  const sessionId = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  if (Date.now() >= session.expiresAt.getTime()) {
    // Expired — clean it up so it doesn't linger in the table forever.
    await prisma.session.delete({ where: { id: sessionId } });
    return null;
  }

  const timeLeft = session.expiresAt.getTime() - Date.now();
  if (timeLeft < RENEWAL_THRESHOLD_MS) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
    });
  }

  return session.user;
}

/** Logout: delete the session row. The cookie itself is cleared separately
 * by the route (see clearSessionCookie below) — deleting the DB row is
 * what actually invalidates it; the cookie is just where it's stored. */
export async function invalidateSession(token: string) {
  await prisma.session.delete({ where: { id: hashToken(token) } }).catch(() => {
    // Already gone (expired/invalidated elsewhere) — logout should still
    // succeed from the user's point of view, so we swallow this.
  });
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true, // JavaScript can't read it — kills XSS session theft (CONCEPTS.md §2.8)
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod; localhost has no HTTPS
    sameSite: "lax", // defends against CSRF while still allowing normal navigation
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}
