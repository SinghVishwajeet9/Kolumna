// Runs once before the whole suite: check we're pointed at a test database,
// then bring its schema up to date with the same migrations production uses.

import { execSync } from "node:child_process";
import { assertTestDatabase } from "./guard.js";

export default function setup() {
  assertTestDatabase(process.env.DATABASE_URL);
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: process.env });
}
