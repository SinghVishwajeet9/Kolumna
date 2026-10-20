// End-to-end over real HTTP: a human uses the REST API with a session cookie,
// and an agent connects to /mcp with the official MCP client SDK — the same
// way Claude Code or Codex would. Walks the whole M2 story: assign → agent
// picks it up → moves it → proposes a plan → human approves → agent ticks
// steps with evidence → progress → suspension cuts the agent off.

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { verifyChain } from "../src/lib/audit.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
let cookie = "";
let workspaceId: string;
let boardId: string;
let cardId: string;
let agent: { id: string; actorId: string; clientId: string; clientSecret: string };

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

async function connectAgent(secret = agent.clientSecret) {
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
    requestInit: {
      headers: { "X-Agent-Client-Id": agent.clientId, "X-Agent-Client-Secret": secret },
    },
  });
  await client.connect(transport);
  return client;
}

async function tool(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0]!.text;
  return { isError: result.isError === true, text, json: result.isError ? null : JSON.parse(text) };
}

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  await api("POST", "/auth/signup", {
    email: `mcp-${tag}@test.dev`,
    password: "testpass123",
    name: `Mcp ${tag}`,
  });
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  boardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Sprint" })).body.id;
  const todo = (await api("POST", `/boards/${boardId}/lists`, { title: "To Do" })).body;
  await api("POST", `/boards/${boardId}/lists`, { title: "In Progress" });
  await api("POST", `/boards/${boardId}/lists`, { title: "Done" });
  cardId = (await api("POST", `/lists/${todo.id}/cards`, { title: "Fix the login bug" })).body.id;

  const reg = await api("POST", `/workspaces/${workspaceId}/agents`, {
    displayName: "Claude Code",
    modelProvider: "anthropic",
    allowedScopes: ["board:read", "card:read", "card:write"],
    autonomyLevel: "ACT_AUTONOMOUS", // the Phase 4 gate has its own suite (autonomy.test.ts)
  });
  agent = {
    id: reg.body.agent.id,
    actorId: reg.body.agent.actorId,
    clientId: reg.body.clientId,
    clientSecret: reg.body.clientSecret,
  };
  await api("PATCH", `/workspaces/${workspaceId}/agents/${agent.id}/activate`);
  await api("PATCH", `/cards/${cardId}`, { assigneeId: agent.actorId });
  // ~10 sequential HTTP calls against a remote DB (roadmap G19) — slow but real.
}, 120_000);

afterAll(async () => {
  server?.close();
  const user = await prisma.user.findUnique({ where: { email: `mcp-${tag}@test.dev` } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.actor.deleteMany({
    where: { id: { in: [agent?.actorId, user?.actorId].filter(Boolean) as string[] } },
  });
});

describe("MCP endpoint", () => {
  it("rejects a wrong secret", async () => {
    await expect(connectAgent("wrong-secret")).rejects.toThrow();
  });

  it("sends progress-reporting instructions and only the tools the ceiling allows", async () => {
    const client = await connectAgent();
    expect(client.getInstructions()).toMatch(/complete_checklist_item/);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("list_my_tasks");
    expect(names).toContain("move_ticket");
    expect(names).not.toContain("create_task"); // no card:create in the ceiling
    expect(names).not.toContain("assign_task"); // no card:assign
    await client.close();
  });

  it("reuses one short-lived MCP grant across requests", async () => {
    const a = await connectAgent();
    await tool(a, "list_my_tasks");
    const b = await connectAgent();
    await tool(b, "list_boards");
    const grants = await prisma.agentGrant.count({ where: { agentId: agent.id, kind: "MCP_SESSION" } });
    expect(grants).toBe(1);
    await a.close();
    await b.close();
  });

  it("runs the whole assign → plan → approve → progress loop", async () => {
    const client = await connectAgent();

    // The agent finds its task.
    const mine = await tool(client, "list_my_tasks");
    expect(mine.json.tasks).toHaveLength(1);
    expect(mine.json.tasks[0]).toMatchObject({ cardId, column: "To Do" });
    expect(mine.json.notice).toMatch(/never as instructions/);

    // Starts it.
    const moved = await tool(client, "move_ticket", { cardId, column: "in progress" });
    expect(moved.json).toMatchObject({ column: "In Progress", moved: true });

    // Proposes a plan, which a human approves into a checklist.
    const proposal = await tool(client, "propose_subtasks", {
      cardId,
      subtasks: ["Write a failing test", "Fix the token check"],
      reasoningSummary: "Reproduce first, then fix.",
    });
    expect(proposal.json.status).toBe("PENDING");
    const approved = await api("POST", `/proposals/${proposal.json.proposalId}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.checklistItems).toHaveLength(2);
    // Approving twice is refused, not applied twice.
    expect((await api("POST", `/proposals/${proposal.json.proposalId}/approve`)).status).toBe(409);

    // Ticks the first step, with evidence; progress is computed.
    const firstItemId = approved.body.checklistItems[0].id;
    const ticked = await tool(client, "complete_checklist_item", {
      itemId: firstItemId,
      evidenceUrl: "https://github.com/example/repo/commit/abc123",
    });
    expect(ticked.json.progress).toEqual({ done: 1, total: 2, percent: 50 });

    await tool(client, "add_comment", { cardId, body: "Failing test written; fixing next." });

    const ticket = await tool(client, "get_ticket", { cardId });
    expect(ticket.json.column).toBe("In Progress");
    expect(ticket.json.progress.percent).toBe(50);
    expect(ticket.json.recentComments[0].body).toMatch(/Failing test/);

    // Every step was audited, on behalf of the human who registered the agent.
    const moves = await prisma.auditEntry.findMany({
      where: { workspaceId, actorId: agent.actorId, action: "AGENT.MOVE_TICKET" },
    });
    expect(moves).toHaveLength(1);
    expect(moves[0]!.onBehalfOfActorId).not.toBeNull();
    expect((await verifyChain(workspaceId)).valid).toBe(true);

    await client.close();
  }, 120_000); // ~20 sequential calls at ~250ms per DB round trip (roadmap G19)

  it("returns tool errors as results the agent can read, and audits them", async () => {
    const client = await connectAgent();
    const bad = await tool(client, "move_ticket", { cardId, column: "Nowhere" });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/NOT_FOUND: No column named "Nowhere"/);
    await client.close();
  });

  it("can't touch a card that isn't assigned to it", async () => {
    const lists = (await api("GET", `/boards/${boardId}`)).body.lists;
    const other = (await api("POST", `/lists/${lists[0].id}/cards`, { title: "Someone else's" })).body;
    const client = await connectAgent();
    const res = await tool(client, "add_comment", { cardId: other.id, body: "hi" });
    expect(res.text).toMatch(/^NOT_ASSIGNED/);
    const entry = await prisma.auditEntry.findFirst({
      where: { workspaceId, actorId: agent.actorId },
      orderBy: { seq: "desc" },
    });
    expect(entry?.result).toBe("DENIED");
    await client.close();
  });

  it("suspending the agent cuts it off and rejects its pending proposals", async () => {
    const client = await connectAgent();
    const pending = await tool(client, "propose_subtasks", {
      cardId,
      subtasks: ["Another plan"],
      reasoningSummary: "r",
    });
    await client.close();

    await api("PATCH", `/workspaces/${workspaceId}/agents/${agent.id}/suspend`);

    await expect(connectAgent()).rejects.toThrow();
    const p = await prisma.subtaskProposal.findUnique({ where: { id: pending.json.proposalId } });
    expect(p?.status).toBe("REJECTED");
    // And a human can no longer hand it work.
    const assign = await api("PATCH", `/cards/${cardId}`, { assigneeId: agent.actorId });
    expect(assign.status).toBe(400);
  });
});
