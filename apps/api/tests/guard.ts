// Refuses to let the test suite touch any database that isn't a test one.
//
// Tests create and delete real rows. On 2026-11-10 a clean-up bug ran
// against the dev database and deleted every workspace in it (see
// cleanup.ts). The fix for that bug is cleanup.ts; this file makes sure that
// even a future bug like it can only ever hit a throwaway database.
//
// Rule: the database name must end in "_test". Used by global-setup.ts
// (before migrations run) and as a vitest setup file (in every test worker,
// before any test file imports Prisma).

export function assertTestDatabase(url: string | undefined): void {
  if (!url) throw new Error("Tests need DATABASE_URL (see apps/api/.env.test).");
  let name: string;
  try {
    name = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error("DATABASE_URL isn't a valid URL.");
  }
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against database "${name}". ` +
        `Tests delete data; they only run against a database whose name ends in "_test". ` +
        `See apps/api/.env.test.`,
    );
  }
}

assertTestDatabase(process.env.DATABASE_URL);
