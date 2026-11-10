// Speed check (G19): how many database round trips each page's API calls
// make, and how long they take. Every round trip costs the full network
// latency to Postgres, so the count matters more than the SQL.
//
//   npx tsx scripts/profile-queries.ts
//
// Builds a small throwaway workspace (board, lists, cards, sprint, epic),
// calls the endpoints the web pages call, prints a table, then deletes it.

import pg from "pg";
import type { AddressInfo } from "node:net";

// Count every query sent to Postgres. Prisma's pg adapter goes through
// pg.Client.query, so patching the prototype sees all of them.
let queries = 0;
let log: string[] | null = null;
const original = pg.Client.prototype.query;
pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
  queries++;
  if (log) {
    const q = args[0] as string | { text: string };
    log.push((typeof q === "string" ? q : q.text).replace(/\s+/g, " ").slice(0, 160));
  }
  return (original as (...a: unknown[]) => unknown).apply(this, args);
} as typeof original;

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let cookie = "";

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0]!;
  const text = await res.text();
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const rows: { page: string; call: string; queries: number; ms: number }[] = [];
// PROFILE_SQL=board,card prints the SQL behind those pages' calls.
const showSql = new Set((process.env.PROFILE_SQL ?? "").split(",").filter(Boolean));
async function measure(page: string, path: string) {
  queries = 0;
  log = showSql.has(page) ? [] : null;
  const t = performance.now();
  await call("GET", path);
  rows.push({ page, call: path.replace(/c[a-z0-9]{20,}/g, ":id"), queries, ms: Math.round(performance.now() - t) });
  if (log) console.log(`\n${path}\n  ` + log.join("\n  "));
  log = null;
}

const email = `profile-${Date.now().toString(36)}@test.dev`;
let workspaceId = "";
try {
  await call("POST", "/auth/signup", { email, password: "profilepass123", name: "Profiler" });
  workspaceId = (await call("GET", "/workspaces"))[0].id;
  const boardId = (await call("POST", `/workspaces/${workspaceId}/boards`, { title: "Profile Board" })).id;
  const lists = [];
  for (const t of ["To Do", "In Progress", "Done"]) lists.push(await call("POST", `/boards/${boardId}/lists`, { title: t }));
  const epic = await call("POST", `/boards/${boardId}/epics`, { title: "Epic" });
  const sprint = await call("POST", `/boards/${boardId}/sprints`, {});
  const cards = [];
  for (let i = 0; i < 12; i++) {
    const c = await call("POST", `/lists/${lists[i % 3].id}/cards`, { title: `Card ${i}` });
    await call("PATCH", `/cards/${c.id}`, { storyPoints: 2, epicId: epic.id, sprintId: i < 8 ? sprint.id : null });
    cards.push(c);
  }
  await call("POST", `/sprints/${sprint.id}/start`, { goal: "Profile" });
  await call("POST", `/cards/${cards[0].id}/comments`, { body: "hello" });
  console.log("seeded; measuring…\n");

  // Run every call twice: the first pass also opens pool connections
  // (slow: several round trips each), the second shows steady state.
  const pass = async () => {
    const ws = `/workspaces/${workspaceId}`;
    // Sidebar + shell (every page)
    await measure("shell", "/auth/me");
    await measure("shell", "/workspaces");
    await measure("shell", `${ws}/boards`);
    await measure("shell", `${ws}/agents`);
    await measure("shell", `${ws}/reviews?status=PENDING`);
    await measure("shell", `${ws}/proposals?status=PENDING`);
    // Board
    await measure("board", `/boards/${boardId}`);
    await measure("board", `${ws}/members`);
    await measure("board", `/boards/${boardId}/sprints`);
    await measure("board", `/boards/${boardId}/epics`);
    await measure("card", `/cards/${cards[0].id}/details`);
    // Backlog / reports
    await measure("backlog", `/boards/${boardId}/backlog`);
    await measure("reports", `/sprints/${sprint.id}/report`);
    // Workspace pages
    await measure("usage", `${ws}/usage`);
    await measure("usage", `${ws}/budgets`);
    await measure("approvals", `${ws}/reviews`);
    await measure("activity", `${ws}/audit`);
    await measure("members", `${ws}/invites`);
    await measure("sprints", `${ws}/sprints`);

  };
  await pass();
  rows.length = 0;
  await pass();

  console.table(rows);
  const total = rows.reduce((s, r) => s + r.queries, 0);
  console.log(`total queries: ${total}`);
} finally {
  server.close();
  const user = await prisma.user.findUnique({ where: { email } });
  if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  if (user) await prisma.actor.deleteMany({ where: { id: user.actorId } });
  await prisma.$disconnect();
}
