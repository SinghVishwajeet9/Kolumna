// Phase 3.5 over real HTTP: epics, the sprint lifecycle (plan → start →
// complete), the sprint-only board view, the backlog, and the guarantees
// around them (per-board epics/sprints, one active sprint, no work into a
// completed sprint).

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { verifyChain } from "../src/lib/audit.js";
import { deleteWorkspaces, deleteActors } from "./cleanup.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
let cookie = "";
let workspaceId: string;
let boardId: string;
let lists: { id: string; title: string }[] = [];
let cards: { id: string; number: number }[] = [];

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0]!;
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await api("POST", "/auth/signup", { email: `plan-${tag}@test.dev`, password: "testpass123", name: "Planner" });
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  boardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Product Road Map" })).body.id;
  for (const t of ["To Do", "In Progress", "Done"]) lists.push((await api("POST", `/boards/${boardId}/lists`, { title: t })).body);
  for (const t of ["Urgent thing", "High thing", "Someday thing"]) cards.push((await api("POST", `/lists/${lists[0]!.id}/cards`, { title: t })).body);
}, 180_000);

afterAll(async () => {
  server?.close();
  const user = await prisma.user.findUnique({ where: { email: `plan-${tag}@test.dev` } });
  await deleteWorkspaces(workspaceId);
  await deleteActors(user?.actorId);
});

describe("planning", () => {
  let sprint1: string;
  let sprint2: string;

  it("numbers cards per board and sets priority, points and epic", async () => {
    expect(cards.map((c) => c.number)).toEqual([1, 2, 3]);
    const epic = (await api("POST", `/boards/${boardId}/epics`, { title: "Onboarding", color: "#7dd3fc" })).body;
    const r = await api("PATCH", `/cards/${cards[0]!.id}`, { priority: "URGENT", storyPoints: 3, epicId: epic.id });
    expect(r.status).toBe(200);
    await api("PATCH", `/cards/${cards[1]!.id}`, { priority: "HIGH" });

    const epics = (await api("GET", `/boards/${boardId}/epics`)).body;
    expect(epics[0]).toMatchObject({ title: "Onboarding", cardCount: 1, doneCount: 0 });
  }, 120_000);

  it("rejects an epic from another board", async () => {
    const other = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Other" })).body;
    const foreignEpic = (await api("POST", `/boards/${other.id}/epics`, { title: "Elsewhere" })).body;
    const r = await api("PATCH", `/cards/${cards[0]!.id}`, { epicId: foreignEpic.id });
    expect(r.status).toBe(400);
  }, 60_000);

  it("plans and starts a sprint; the board then shows only sprint cards", async () => {
    const s = (await api("POST", `/boards/${boardId}/sprints`, {})).body;
    expect(s.name).toBe("PRM Sprint 1");
    sprint1 = s.id;
    await api("PATCH", `/cards/${cards[0]!.id}`, { sprintId: sprint1 });
    await api("PATCH", `/cards/${cards[1]!.id}`, { sprintId: sprint1 });

    const started = await api("POST", `/sprints/${sprint1}/start`, { goal: "Ship onboarding" });
    expect(started.body.status).toBe("ACTIVE");

    const board = (await api("GET", `/boards/${boardId}`)).body;
    expect(board.activeSprint.id).toBe(sprint1);
    const shown = board.lists.flatMap((l: { cards: { id: string }[] }) => l.cards.map((c) => c.id));
    expect(shown.sort()).toEqual([cards[0]!.id, cards[1]!.id].sort()); // "Someday thing" is hidden
  }, 120_000);

  it("adds a card created on the board to the active sprint", async () => {
    const c = (await api("POST", `/lists/${lists[0]!.id}/cards`, { title: "Found mid-sprint" })).body;
    expect(c.sprintId).toBe(sprint1);
    expect(c.number).toBe(4);
    // …unless the backlog page asks for the backlog explicitly.
    const b = (await api("POST", `/lists/${lists[0]!.id}/cards`, { title: "Later idea", sprintId: null })).body;
    expect(b.sprintId).toBeNull();
    cards.push(b);
  }, 60_000);

  it("refuses a second active sprint on the same board (database-enforced)", async () => {
    sprint2 = (await api("POST", `/boards/${boardId}/sprints`, {})).body.id;
    const r = await api("POST", `/sprints/${sprint2}/start`);
    expect(r.status).toBe(409);
  }, 60_000);

  it("lists the backlog by priority, active sprint first", async () => {
    const b = (await api("GET", `/boards/${boardId}/backlog`)).body;
    expect(b.sprints.map((s: { id: string }) => s.id)).toEqual([sprint1, sprint2]);
    expect(b.sprints[0].cards[0].title).toBe("Urgent thing"); // URGENT before HIGH
    expect(b.backlog.map((c: { title: string }) => c.title)).toEqual(["Someday thing", "Later idea"]);
  }, 60_000);

  it("completing a sprint moves only unfinished cards to the next sprint", async () => {
    // Finish "Urgent thing" by moving it to the last column (Done).
    await api("PATCH", `/cards/${cards[0]!.id}/move`, { listId: lists[2]!.id, beforeId: null, afterId: null });
    const r = await api("POST", `/sprints/${sprint1}/complete`, { moveOpenCardsTo: sprint2 });
    expect(r.status).toBe(200);
    expect(r.body.movedCards).toBe(2); // "High thing" + "Found mid-sprint"

    const done = await prisma.card.findUnique({ where: { id: cards[0]!.id } });
    expect(done?.sprintId).toBe(sprint1); // finished work stays with its sprint
    const epics = (await api("GET", `/boards/${boardId}/epics`)).body;
    expect(epics.find((e: { title: string }) => e.title === "Onboarding")).toMatchObject({ doneCount: 1 });

    // With no active sprint, the board shows every card again.
    const board = (await api("GET", `/boards/${boardId}`)).body;
    expect(board.activeSprint).toBeNull();
    expect(board.lists.flatMap((l: { cards: unknown[] }) => l.cards)).toHaveLength(5);
  }, 120_000);

  it("won't put work into a completed sprint, and every step was audited", async () => {
    const r = await api("PATCH", `/cards/${cards[2]!.id}`, { sprintId: sprint1 });
    expect(r.status).toBe(400);
    const actions = (await prisma.auditEntry.findMany({ where: { workspaceId }, select: { action: true } })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["EPIC.CREATE", "SPRINT.CREATE", "SPRINT.START", "SPRINT.COMPLETE"]));
    expect((await verifyChain(workspaceId)).valid).toBe(true);
  }, 60_000);
});
