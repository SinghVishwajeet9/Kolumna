import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests use their own database, from .env.test, never the one in .env.
// `override` matters: it wins over anything already in the environment, and
// dotenv in src/lib/env.ts then leaves these values alone.
// CI sets DATABASE_URL itself; KOLUMNA_TEST_ENV_FROM_CI skips the file there.
if (!process.env.KOLUMNA_TEST_ENV_FROM_CI) config({ path: ".env.test", override: true });

export default defineConfig({
  test: {
    environment: "node",
    // Refuse to start unless DATABASE_URL names a "_test" database (tests/guard.ts),
    // then apply migrations to it.
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/guard.ts"],
    env: { DATABASE_URL: process.env.DATABASE_URL! },
    // Files share one database, so run them one at a time — parallel files
    // would race on the same rows.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
