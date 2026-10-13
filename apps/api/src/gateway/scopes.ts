// The complete scope vocabulary. Every tool declares one of these as its
// requiredScope; every grant carries a subset of its agent's allowedScopes.
import { z } from "zod";

// card:write — change cards assigned to YOU (move, comment, checklist, propose).
// card:create — make new cards. card:assign — hand any card to any member.
export const SCOPES = ["board:read", "card:read", "card:write", "card:create", "card:assign"] as const;
export type Scope = (typeof SCOPES)[number];

export const scopeListSchema = z.array(z.enum(SCOPES)).min(1);

// Grant scopes are stored as Json; anything that isn't a known scope string is
// dropped rather than trusted.
export function parseScopes(value: unknown): Scope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
}

export function isSubset(requested: readonly string[], allowed: readonly string[]) {
  return requested.every((s) => allowed.includes(s));
}
