// Safe test clean-up.
//
// Prisma ignores a filter whose value is `undefined`, so
//   prisma.workspace.deleteMany({ where: { id: workspaceId } })
// with workspaceId never set (setup failed, e.g. the database was briefly
// unreachable) becomes deleteMany({ where: {} }) and deletes EVERY workspace
// in the database. That happened on 2026-11-10 and wiped the dev database's
// real workspaces.
//
// Always clean up by an explicit id list: unset ids are dropped, and an
// empty `in` list matches nothing.

import { prisma } from "../src/lib/prisma.js";

export function ids(...values: (string | null | undefined)[]): { in: string[] } {
  return { in: values.filter((v): v is string => typeof v === "string" && v.length > 0) };
}

export async function deleteWorkspaces(...values: (string | null | undefined)[]) {
  await prisma.workspace.deleteMany({ where: { id: ids(...values) } });
}

export async function deleteActors(...values: (string | null | undefined)[]) {
  await prisma.actor.deleteMany({ where: { id: ids(...values) } });
}
