// Centralizes reading process.env so the rest of the app never touches it
// directly. If a required variable is missing, fail loudly at startup —
// not silently, three requests later, with a confusing crash.

import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  // Where links we hand out (invites) should point: the web app.
  webUrl: process.env.WEB_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:3000",
  databaseUrl: required("DATABASE_URL"),
  // Only the optional agent-run worker (worker.ts) uses Redis; the API itself
  // doesn't, so hosting it without Redis is fine.
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
};
