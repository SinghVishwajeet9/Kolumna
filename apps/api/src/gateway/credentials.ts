// Credential generation/hashing for the agent gateway. Same core idea as
// lib/session.ts: the raw secret only ever exists once, at issuance/creation
// — the database only ever stores a SHA-256 hash of it. SHA-256 (not
// argon2) is correct here for the same reason it's correct for sessions:
// these are high-entropy random strings, not user-chosen low-entropy
// passwords, so there's nothing for a slow hash to defend against — a
// leaked hash still can't be reversed into the original secret, and a fast
// hash costs nothing at verification time. See CONCEPTS.md §5.2.

import { randomBytes, createHash } from "node:crypto";

export function generateClientId(): string {
  return `agent_${randomBytes(8).toString("hex")}`;
}

/** The agent's long-lived secret, shown once at registration. */
export function generateClientSecret(): string {
  return randomBytes(24).toString("base64url");
}

/** The short-lived access token issued per client-credentials exchange. */
export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
