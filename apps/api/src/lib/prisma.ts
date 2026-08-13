// The single shared Prisma Client instance for the whole app.
// Every repository imports from here — nothing should construct its own
// PrismaClient. See ARCHITECTURE.md §4 (repository layer).

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma = new PrismaClient({ adapter });
