// The single shared Prisma Client instance for the whole app.
// Every repository imports from here — nothing should construct its own
// PrismaClient. See ARCHITECTURE.md §4 (repository layer).

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

// Opening a connection to Postgres is the slowest thing the API does: DNS,
// TCP, TLS and auth are several round trips (measured ~2 s to a far-away
// Neon region, vs ~250 ms per query). pg's default closes idle connections
// after 10 s, so a user who paused for a moment paid that again on their
// next click. Keep connections open for 5 minutes instead (G19).
const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 5 * 60_000,
  keepAlive: true,
});

export const prisma = new PrismaClient({ adapter });
