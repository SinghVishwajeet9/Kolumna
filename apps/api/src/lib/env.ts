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
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
};
