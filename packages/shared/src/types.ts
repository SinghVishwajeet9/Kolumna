// Types shared between apps/web and apps/api.
// This is the contract between frontend and backend — when the API's shape
// changes, update it here and TypeScript will flag every place on both sides
// that needs to catch up.

// Placeholder for Day 1 — proves the monorepo linking works end to end.
// Real domain types (Board, List, Card, Workspace...) get added from Day 6 on,
// once the Prisma schema exists and we know the real shapes.
export interface HealthCheck {
  ok: boolean;
  service: string;
}
