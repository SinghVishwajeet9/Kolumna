// Phase 6 — completion tracking, the blended burndown, and agent reliability
// (snapshots at sprint completion + promotion suggestions).

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { callTool } from "../src/gateway/tools.js";
import { createGrant } from "../src/gateway/agentGrant.repo.js";
import { suggestAutonomy, type Reliability } from "../src/lib/reliability.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
let cookie = "";
let workspaceId: string;
let humanActorId: string;
let boardId: string;
const cols: Record<string, string> = {};
let agentId: string;
let agentActorId: string;
let sprintId: string;
const card: Record<string, string> = {};

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

const move = (id: string, column: string) => api("PATCH", `/cards/${id}/move`, { listId: cols[column], beforeId: null, afterId: null });

async function agentCall(name: string, input: Record<string, unknown>) {
  const { grant } = await createGrant({ agentId, workspaceId, scopes: ["board:read", "card:read", "card:write"], ttlSeconds: 600, issuedByActorId: humanActorId });
  return callTool(name, input, { grantId: grant.id }) as Promise<Record<string, unknown>>;
}

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await api("POST", "/auth/signup", { email: `rep-${tag}@test.dev`, password: "testpass123", name: "Lead" });
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  humanActorId = (await prisma.user.findUniqueOrThrow({ where: { email: `rep-${tag}@test.dev` } })).actorId;
  boardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Report Board" })).body.id;
  for (const t of ["To Do", "Doing", "Done"]) cols[t] = (await api("POST", `/boards/${boardId}/lists`, { title: t })).body.id;

  const reg = await api("POST", `/workspaces/${workspaceId}/agents`, {
    displayName: "Builder",
    modelProvider: "external",
    allowedScopes: ["board:read", "card:read", "card:write"],
    autonomyLevel: "ACT_AUTONOMOUS",
  });
  agentId = reg.body.agent.id;
  agentActorId = reg.body.agent.actorId;
  await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/activate`);

  sprintId = (await api("POST", `/boards/${boardId}/sprints`, {})).body.id;
  for (const [name, points, who] of [
    ["human", 3, humanActorId],
    ["agent", 5, agentActorId],
    ["open", 2, humanActorId],
  ] as const) {
    card[name] = (await api("POST", `/lists/${cols["To Do"]}/cards`, { title: name })).body.id;
    await api("PATCH", `/cards/${card[name]}`, { sprintId, storyPoints: points, assigneeId: who });
  }
  await api("POST", `/workspaces/${workspaceId}/budgets`, { sprintId, costCapUsd: 10 });
  await api("POST", `/sprints/${sprintId}/start`, { humanCapacityHours: 40 });
}, 240_000);

afterAll(async () => {
  server?.close();
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.actor.deleteMany({ where: { id: { in: [humanActorId, agentActorId] } } });
});

describe("completion tracking", () => {
  it("records when a card reaches Done and whose work it was; leaving Done is an audited reopen", async () => {
    await move(card.human!, "Done");
    let c = await prisma.card.findUniqueOrThrow({ where: { id: card.human! } });
    expect(c.doneAt).not.toBeNull();
    expect(c.doneAssigneeId).toBe(humanActorId);

    await move(card.human!, "Doing");
    c = await prisma.card.findUniqueOrThrow({ where: { id: card.human! } });
    expect(c.doneAt).toBeNull();
    const reopen = await prisma.auditEntry.findFirst({ where: { workspaceId, action: "CARD.REOPEN", targetId: card.human! } });
    expect(reopen?.resource).toBe(humanActorId);

    await move(card.human!, "Done");
  }, 120_000);

  it("credits an agent that moves its own card to Done", async () => {
    await agentCall("move_ticket", { cardId: card.agent!, column: "Done" });
    const c = await prisma.card.findUniqueOrThrow({ where: { id: card.agent! } });
    expect(c.doneAssigneeId).toBe(agentActorId);
  }, 60_000);
});

describe("the sprint report", () => {
  it("burns down one scope, split by who finished it, next to both kinds of capacity", async () => {
    await agentCall("report_usage", { cardId: card.agent!, costUsd: 2.5 });
    const r = (await api("GET", `/sprints/${sprintId}/report`)).body;
    expect(r.points).toMatchObject({
      scope: 10,
      done: 8,
      doneByHumans: 3,
      doneByAgents: 5,
      committedToHumans: 5,
      committedToAgents: 5,
      carriedOver: 0,
    });
    expect(r.capacity).toEqual({ humanHours: 40, agentBudgetUsd: "10.00", agentSpentUsd: "2.50" });
    expect(r.cost).toMatchObject({ usd: "2.50", usdPerPoint: "0.31" }); // 2.50 / 8 done points
    expect(r.days[0]).toMatchObject({ ideal: 10, remaining: 2, doneHuman: 3, doneAgent: 5 }); // all done today
    expect(r.days.length).toBe(15); // two-week default: day 0 … day 14
    expect(r.days.at(-1)).toMatchObject({ ideal: 0, remaining: null }); // the future isn't drawn
  }, 120_000);

  it("on completion: unfinished points are carried over (scope still adds up), and each agent gets a snapshot", async () => {
    expect((await api("POST", `/sprints/${sprintId}/complete`, { moveOpenCardsTo: null })).status).toBe(200);
    const r = (await api("GET", `/sprints/${sprintId}/report`)).body;
    expect(r.points).toMatchObject({ scope: 10, done: 8, carriedOver: 2 });
    expect(r.agents).toHaveLength(1);
    expect(r.agents[0]).toMatchObject({ name: "Builder", cardsDone: 1, pointsDone: 5, reopened: 0, costUsd: "2.50" });
  }, 180_000);
});

describe("agent reliability", () => {
  it("counts approvals, rejections and reopens of its work, and shows its sprint trend", async () => {
    await prisma.agent.update({ where: { id: agentId }, data: { autonomyLevel: "SUGGEST_ONLY" } });
    const ids: string[] = [];
    for (const t of ["a", "b"]) {
      const id = (await api("POST", `/lists/${cols["To Do"]}/cards`, { title: `rel-${t}` })).body.id;
      await api("PATCH", `/cards/${id}`, { assigneeId: agentActorId });
      ids.push(String((await agentCall("move_ticket", { cardId: id, column: "Doing", confidence: 0.7 })).reviewId));
    }
    await api("POST", `/reviews/${ids[0]}/approve`);
    await api("POST", `/reviews/${ids[1]}/reject`, { note: "no" });
    await move(card.agent!, "Doing"); // reopen the agent's finished card

    const rel = (await api("GET", `/workspaces/${workspaceId}/agents/${agentId}/reliability`)).body;
    expect(rel.last30).toMatchObject({ reviewsDecided: 2, reviewsApproved: 1, approvalRate: 0.5, reopened: 1, avgConfidence: 0.7 });
    expect(rel.trend).toHaveLength(1);
    expect(rel.suggestion.kind).toBe("NONE"); // not enough history either way
  }, 240_000);
});

describe("autonomy suggestions", () => {
  const base: Reliability = {
    cardsDone: 0, pointsDone: 0, reopened: 0, reviewsDecided: 0, reviewsApproved: 0,
    approvalRate: null, reopenRate: null, avgConfidence: null, deniedCalls: 0, toolCalls: 0, costUsd: null,
  };
  it("promotes only with enough clean history", () => {
    const good = { ...base, cardsDone: 4, reviewsDecided: 12, reviewsApproved: 11, approvalRate: 11 / 12, reopenRate: 0 };
    expect(suggestAutonomy("ACT_WITH_APPROVAL", good)).toMatchObject({ kind: "PROMOTE", to: "ACT_AUTONOMOUS" });
    expect(suggestAutonomy("ACT_WITH_APPROVAL", { ...good, reviewsDecided: 4 })).toMatchObject({ kind: "NONE" });
    expect(suggestAutonomy("ACT_AUTONOMOUS", good)).toMatchObject({ kind: "NONE" });
  });
  it("suggests demotion on poor approval or heavy rework, never below suggest-only", () => {
    const poor = { ...base, reviewsDecided: 6, reviewsApproved: 2, approvalRate: 2 / 6 };
    expect(suggestAutonomy("ACT_AUTONOMOUS", poor)).toMatchObject({ kind: "DEMOTE", to: "ACT_WITH_APPROVAL" });
    const rework = { ...base, cardsDone: 4, reopened: 2, reopenRate: 0.5 };
    expect(suggestAutonomy("ACT_WITH_APPROVAL", rework)).toMatchObject({ kind: "DEMOTE", to: "SUGGEST_ONLY" });
    expect(suggestAutonomy("SUGGEST_ONLY", poor).kind).not.toBe("DEMOTE");
  });
});
