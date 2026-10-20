// Phase 5 — cost accounting and budgets. Checks the money math is exact
// (Decimal, not float), that rollups snapshot where the spend happened, and
// that a used-up budget routes an agent's changes through a human.

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { callTool, ToolError } from "../src/gateway/tools.js";
import { createGrant } from "../src/gateway/agentGrant.repo.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
const cookies = { admin: "", member: "" };
let workspaceId: string;
let otherWorkspaceId: string;
let adminActorId: string;
let memberActorId: string;
let boardId: string;
let todo: string;
let agentId: string;
let agentActorId: string;
let sprintId: string;
let epicId: string;
let cardId: string; // in the sprint and the epic, assigned to the agent

async function api(method: string, path: string, body?: unknown, who: keyof typeof cookies = "admin") {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", cookie: cookies[who] },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookies[who] = setCookie.split(";")[0]!;
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function call(name: string, input: Record<string, unknown>) {
  const { grant } = await createGrant({
    agentId,
    workspaceId,
    scopes: ["board:read", "card:read", "card:write"],
    ttlSeconds: 600,
    issuedByActorId: adminActorId,
  });
  return callTool(name, input, { grantId: grant.id }) as Promise<Record<string, unknown>>;
}

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await api("POST", "/auth/signup", { email: `cost-a-${tag}@test.dev`, password: "testpass123", name: "Admin" });
  await api("POST", "/auth/signup", { email: `cost-m-${tag}@test.dev`, password: "testpass123", name: "Member" }, "member");
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  otherWorkspaceId = (await api("GET", "/workspaces", undefined, "member")).body[0].id;
  adminActorId = (await prisma.user.findUniqueOrThrow({ where: { email: `cost-a-${tag}@test.dev` } })).actorId;
  memberActorId = (await prisma.user.findUniqueOrThrow({ where: { email: `cost-m-${tag}@test.dev` } })).actorId;
  await prisma.membership.create({ data: { actorId: memberActorId, workspaceId, role: "MEMBER" } });

  boardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Cost Board" })).body.id;
  todo = (await api("POST", `/boards/${boardId}/lists`, { title: "To Do" })).body.id;
  await api("POST", `/boards/${boardId}/lists`, { title: "Done" });

  const reg = await api("POST", `/workspaces/${workspaceId}/agents`, {
    displayName: "Spender",
    modelProvider: "external",
    allowedScopes: ["board:read", "card:read", "card:write"],
    autonomyLevel: "ACT_AUTONOMOUS",
  });
  agentId = reg.body.agent.id;
  agentActorId = reg.body.agent.actorId;
  await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/activate`);

  epicId = (await api("POST", `/boards/${boardId}/epics`, { title: "Billing" })).body.id;
  sprintId = (await api("POST", `/boards/${boardId}/sprints`, {})).body.id;
  cardId = (await api("POST", `/lists/${todo}/cards`, { title: "Invoice export" })).body.id;
  await api("PATCH", `/cards/${cardId}`, { sprintId, epicId, storyPoints: 5, assigneeId: agentActorId });
}, 240_000);

afterAll(async () => {
  server?.close();
  await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, otherWorkspaceId] } } });
  await prisma.actor.deleteMany({ where: { id: { in: [adminActorId, memberActorId, agentActorId] } } });
});

describe("report_usage", () => {
  it("records self-reported spend against the card, with its sprint and epic snapshotted", async () => {
    const out = await call("report_usage", { cardId, costUsd: 0.1, tokensIn: 1000, tokensOut: 200, note: "first pass" });
    expect(out).toMatchObject({ recorded: true, costUsd: "0.100000" });
    const ev = await prisma.costEvent.findFirstOrThrow({ where: { cardId } });
    expect(ev).toMatchObject({ source: "SELF_REPORTED", sprintId, epicId, boardId, agentId, actorId: agentActorId });
    const audit = await prisma.auditEntry.findFirst({ where: { workspaceId, action: "AGENT.REPORT_USAGE" } });
    expect(audit?.resource).toMatch(/self-reported/);
  }, 60_000);

  it("adds money exactly: 0.1 + 0.2 is 0.30, not 0.30000000000000004", async () => {
    await call("report_usage", { cardId, costUsd: 0.2 });
    const details = (await api("GET", `/cards/${cardId}/details`)).body;
    expect(details.cost).toMatchObject({ costUsd: "0.30", tokens: 1200, events: 2 });
  }, 60_000);

  it("prices tokens from the workspace's model table, and says so when it can't", async () => {
    expect((await api("PUT", `/workspaces/${workspaceId}/model-prices`, { model: "test-model", inputPerMTokUsd: 3, outputPerMTokUsd: 15 })).status).toBe(200);
    // 1M in at $3 + 0.5M out at $15 = $3 + $7.50
    const priced = await call("report_usage", { tokensIn: 1_000_000, tokensOut: 500_000, model: "test-model" });
    expect(priced.costUsd).toBe("10.500000");
    const unknown = await call("report_usage", { tokensIn: 10, model: "mystery-model" });
    expect(unknown.costUsd).toBeNull();
    expect(unknown.note).toMatch(/No price set for mystery-model/);
  }, 60_000);

  it("can't bill another member's card, or report nothing", async () => {
    const theirs = (await api("POST", `/lists/${todo}/cards`, { title: "Not yours" })).body.id;
    const e1 = await call("report_usage", { cardId: theirs, costUsd: 1 }).then(() => null, (e) => e);
    expect((e1 as ToolError).code).toBe("NOT_ASSIGNED");
    const e2 = await call("report_usage", { cardId }).then(() => null, (e) => e);
    expect((e2 as ToolError).code).toBe("INVALID_INPUT");
  }, 60_000);

  it("keeps the sprint's cost where it was spent when the card moves on", async () => {
    const next = (await api("POST", `/boards/${boardId}/sprints`, {})).body.id;
    await api("PATCH", `/cards/${cardId}`, { sprintId: next });
    await call("report_usage", { cardId, costUsd: 1 });
    const backlog = (await api("GET", `/boards/${boardId}/backlog`)).body;
    const cost = (id: string) => backlog.sprints.find((s: { id: string }) => s.id === id)?.costUsd;
    expect(cost(sprintId)).toBe("0.30");
    expect(cost(next)).toBe("1.00");
    await api("PATCH", `/cards/${cardId}`, { sprintId });
  }, 120_000);
});

describe("budgets", () => {
  let budgetId: string;

  it("alerts once at the line, then marks itself exceeded — both audited", async () => {
    const created = await api("POST", `/workspaces/${workspaceId}/budgets`, { sprintId, costCapUsd: 2, alertAt: 0.5 });
    expect(created.status).toBe(201);
    budgetId = created.body.id;
    expect(created.body).toMatchObject({ spentUsd: "0.30", state: "OK" });

    const warn = await call("report_usage", { cardId, costUsd: 0.8 }); // 1.10 of 2.00
    expect(warn.budgets).toEqual([{ scope: "sprint", used: "55%", state: "ALERT" }]);
    await call("report_usage", { cardId, costUsd: 0.01 }); // still alert — no second BUDGET.ALERT
    expect(await prisma.auditEntry.count({ where: { workspaceId, action: "BUDGET.ALERT" } })).toBe(1);

    const over = await call("report_usage", { cardId, costUsd: 1 }); // 2.11 of 2.00
    expect(over.warning).toMatch(/used up/);
    expect(await prisma.auditEntry.count({ where: { workspaceId, action: "BUDGET.EXCEEDED" } })).toBe(1);
  }, 120_000);

  it("an exhausted budget sends even an autonomous agent's changes to a human", async () => {
    const out = await call("move_ticket", { cardId, column: "Done", confidence: 1 });
    expect(out).toMatchObject({ status: "PENDING_APPROVAL", why: "the sprint budget is used up" });
    const review = await prisma.confidenceReview.findUniqueOrThrow({ where: { id: String(out.reviewId) } });
    expect(review.reason).toBe("BUDGET_EXCEEDED");
    // Talking and reporting still work.
    expect((await call("add_comment", { cardId, body: "Over budget, waiting" })).commentId).toBeTruthy();
  }, 120_000);

  it("raising the cap lets it act on its own again", async () => {
    const r = await api("PATCH", `/budgets/${budgetId}`, { costCapUsd: 50 });
    expect(r.body.state).toBe("OK");
    expect((await prisma.usageBudget.findUniqueOrThrow({ where: { id: budgetId } })).exceededAt).toBeNull();
    const out = await call("move_ticket", { cardId, column: "Done" });
    expect(out.status).toBeUndefined();
  }, 120_000);

  it("only owners and admins set budgets and prices", async () => {
    expect((await api("POST", `/workspaces/${workspaceId}/budgets`, { costCapUsd: 1 }, "member")).status).toBe(403);
    expect((await api("PUT", `/workspaces/${workspaceId}/model-prices`, { model: "x", inputPerMTokUsd: 1, outputPerMTokUsd: 1 }, "member")).status).toBe(403);
    expect((await api("GET", `/workspaces/${workspaceId}/budgets`, undefined, "member")).status).toBe(200);
  }, 60_000);
});

describe("the usage report", () => {
  it("rolls up by agent, sprint (with $/point) and epic, and separates self-reported spend", async () => {
    await api("POST", `/workspaces/${workspaceId}/costs`, { agentId, cardId, costUsd: 0.5, note: "from /cost" });
    const u = (await api("GET", `/workspaces/${workspaceId}/usage`)).body;
    // 0.1+0.2+10.5+1+0.8+0.01+1 self-reported, +0.5 manual
    expect(u.month).toMatchObject({ costUsd: "14.11", selfReportedUsd: "13.61" });
    expect(u.byAgent[0]).toMatchObject({ name: "Spender", costUsd: "14.11" });
    const sprint = u.bySprint.find((s: { sprintId: string }) => s.sprintId === sprintId);
    expect(sprint).toMatchObject({ costUsd: "2.61", points: 5, usdPerPoint: "0.52" });
    expect(u.byEpic[0]).toMatchObject({ title: "Billing", costUsd: "3.61" });
    expect(u.recent[0]).toMatchObject({ source: "MANUAL", note: "from /cost" });
  }, 120_000);
});
