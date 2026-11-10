// Phase 3.5 slice 4: what agents see and can do around sprints (card keys,
// get_sprint, update_ticket, create_task's backlog default) and G14 — an
// agent's access ending with a date or a sprint.

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { callTool, ToolError } from "../src/gateway/tools.js";
import { AccessEndedError, createGrant } from "../src/gateway/agentGrant.repo.js";
import { deleteWorkspaces, deleteActors } from "./cleanup.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
let cookie = "";
let workspaceId: string;
let humanActorId: string;
let boardId: string;
let lists: { id: string }[] = [];
let agentId: string;
let agentActorId: string;
let sprintId: string;

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

async function grant(ttlSeconds = 3600) {
  const { grant } = await createGrant({
    agentId,
    workspaceId,
    scopes: ["board:read", "card:read", "card:write", "card:create"],
    ttlSeconds,
    issuedByActorId: humanActorId,
  });
  return grant;
}

async function toolError(p: Promise<unknown>) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ToolError);
  return err as ToolError;
}

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await api("POST", "/auth/signup", { email: `sa-${tag}@test.dev`, password: "testpass123", name: "Lead" });
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  humanActorId = (await prisma.user.findUniqueOrThrow({ where: { email: `sa-${tag}@test.dev` } })).actorId;
  boardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Agent Work" })).body.id;
  for (const t of ["To Do", "Doing", "Done"]) lists.push((await api("POST", `/boards/${boardId}/lists`, { title: t })).body);

  const actor = await prisma.actor.create({ data: { type: "AGENT", displayName: `Sprint bot ${tag}` } });
  agentActorId = actor.id;
  await prisma.membership.create({ data: { actorId: actor.id, workspaceId, role: "MEMBER" } });
  agentId = (
    await prisma.agent.create({
      data: {
        actorId: actor.id,
        workspaceId,
        ownerActorId: humanActorId,
        modelProvider: "anthropic",
        capabilities: {},
        allowedScopes: ["board:read", "card:read", "card:write", "card:create"],
        autonomyLevel: "ACT_AUTONOMOUS",
        status: "ACTIVE",
        clientId: `sa_${tag}`,
        hashedClientSecret: "x",
      },
    })
  ).id;

  // AW-1 (in the sprint, assigned to the agent), AW-2 (backlog).
  const c1 = (await api("POST", `/lists/${lists[0]!.id}/cards`, { title: "Agent's sprint task" })).body;
  await api("POST", `/lists/${lists[0]!.id}/cards`, { title: "Backlog idea" });
  sprintId = (await api("POST", `/boards/${boardId}/sprints`, { goal: "Ship it" })).body.id;
  await api("PATCH", `/cards/${c1.id}`, { sprintId, assigneeId: agentActorId, priority: "HIGH", storyPoints: 3 });
  await api("POST", `/sprints/${sprintId}/start`);
}, 180_000);

afterAll(async () => {
  server?.close();
  await deleteWorkspaces(workspaceId);
  await deleteActors(humanActorId, agentActorId);
});

describe("agent tools around sprints", () => {
  it("list_my_tasks and get_ticket speak in card keys, and accept them", async () => {
    const g = await grant();
    const mine = (await callTool("list_my_tasks", {}, { grantId: g.id })) as { tasks: Record<string, unknown>[] };
    expect(mine.tasks[0]).toMatchObject({ key: "AW-1", priority: "HIGH", storyPoints: 3, sprint: { status: "ACTIVE" } });

    const ticket = (await callTool("get_ticket", { cardId: "aw-1" }, { grantId: g.id })) as { title: string };
    expect(ticket.title).toBe("Agent's sprint task");
    expect((await toolError(callTool("get_ticket", { cardId: "AW-99" }, { grantId: g.id }))).code).toBe("NOT_FOUND");
  }, 60_000);

  it("get_sprint reports the goal, cards and points done", async () => {
    const g = await grant();
    const s = (await callTool("get_sprint", { boardId }, { grantId: g.id })) as {
      activeSprint: { goal: string; cards: { done: number; total: number }; points: { total: number } };
      cards: { key: string; assignee: { isYou: boolean } }[];
    };
    expect(s.activeSprint).toMatchObject({ goal: "Ship it", cards: { done: 0, total: 1 }, points: { total: 3 } });
    expect(s.cards[0]).toMatchObject({ key: "AW-1", assignee: { isYou: true } });
  }, 60_000);

  it("update_ticket re-estimates its own card, by key, and is audited", async () => {
    const g = await grant();
    const out = await callTool("update_ticket", { cardId: "AW-1", storyPoints: 8, priority: "URGENT" }, { grantId: g.id });
    expect(out).toMatchObject({ key: "AW-1", storyPoints: 8, priority: "URGENT" });
    const entry = await prisma.auditEntry.findFirst({ where: { workspaceId }, orderBy: { seq: "desc" } });
    expect(entry).toMatchObject({ action: "AGENT.UPDATE_TICKET", resource: "priority HIGH -> URGENT, points 3 -> 8" });

    // Not its card → refused, like every other card:write tool.
    expect((await toolError(callTool("update_ticket", { cardId: "AW-2", priority: "LOW" }, { grantId: g.id }))).code).toBe(
      "NOT_ASSIGNED",
    );
  }, 60_000);

  it("create_task goes to the backlog unless asked to join the sprint", async () => {
    const g = await grant();
    const a = (await callTool("create_task", { boardId, column: "To Do", title: "Follow-up" }, { grantId: g.id })) as {
      cardId: string;
      key: string;
      sprint: string;
    };
    expect(a).toMatchObject({ key: "AW-3", sprint: "backlog" });
    const b = (await callTool(
      "create_task",
      { boardId, column: "To Do", title: "Urgent fix", addToActiveSprint: true, priority: "URGENT" },
      { grantId: g.id },
    )) as { cardId: string };
    const card = await prisma.card.findUniqueOrThrow({ where: { id: b.cardId } });
    expect(card).toMatchObject({ sprintId, priority: "URGENT" });
  }, 60_000);
});

describe("G14 — agent access ends with a date or a sprint", () => {
  it("caps a grant at accessUntil, and refuses new grants once it has passed", async () => {
    const soon = new Date(Date.now() + 10 * 60_000);
    expect((await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/access`, { accessUntil: soon.toISOString() })).status).toBe(200);
    const g = await grant(3600); // asks for an hour…
    expect(g.expiresAt.getTime()).toBe(soon.getTime()); // …gets ten minutes

    await prisma.agent.update({ where: { id: agentId }, data: { accessUntil: new Date(Date.now() - 1000) } });
    await expect(grant()).rejects.toBeInstanceOf(AccessEndedError);
    await prisma.agent.update({ where: { id: agentId }, data: { accessUntil: null } });
  }, 60_000);

  it("shortening access caps grants that are already live", async () => {
    const g = await grant(3600);
    const end = new Date(Date.now() + 5 * 60_000);
    await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/access`, { accessUntil: end.toISOString() });
    const after = await prisma.agentGrant.findUniqueOrThrow({ where: { id: g.id } });
    expect(after.expiresAt.getTime()).toBe(end.getTime());
    await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/access`, { accessUntil: null });
  }, 60_000);

  it("tied to a sprint: completing it kills live grants and blocks new ones", async () => {
    const r = await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/access`, { accessSprintId: sprintId });
    expect(r.body.accessSprint).toMatchObject({ id: sprintId, status: "ACTIVE" });
    const g = await grant();
    await callTool("list_my_tasks", {}, { grantId: g.id }); // works while the sprint runs

    expect((await api("POST", `/sprints/${sprintId}/complete`, { moveOpenCardsTo: null })).status).toBe(200);

    expect((await toolError(callTool("list_my_tasks", {}, { grantId: g.id }))).code).toBe("GRANT_INVALID");
    await expect(grant()).rejects.toBeInstanceOf(AccessEndedError);
    const ended = await prisma.auditEntry.findFirst({ where: { workspaceId, action: "AGENT.ACCESS_ENDED" } });
    expect(ended?.targetId).toBe(agentId);

    const listed = (await api("GET", `/workspaces/${workspaceId}/agents`)).body.find((a: { id: string }) => a.id === agentId);
    expect(listed).toMatchObject({ accessEnded: true, accessSprint: { status: "COMPLETED" } });
  }, 120_000);

  it("won't tie an agent to a sprint that's already over", async () => {
    const r = await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/access`, { accessSprintId: sprintId });
    expect(r.status).toBe(400);
  }, 60_000);
});
