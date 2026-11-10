// Phase 4 — autonomy levels and confidence gates, plus G11 (only owners and
// admins govern agents). Every gated outcome is checked on the DATA (did the
// card actually move?) and in the audit log, not just in the tool's reply.

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { callTool, describeTools, ToolError } from "../src/gateway/tools.js";
import { createGrant } from "../src/gateway/agentGrant.repo.js";
import { deleteWorkspaces, deleteActors } from "./cleanup.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
const cookies = { admin: "", member: "" };
let workspaceId: string;
let adminActorId: string;
let memberActorId: string;
let boardId: string;
let otherBoardId: string;
let todo: string;
let agentId: string;
let agentActorId: string;
const created: string[] = [];

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

const setAgent = (data: { autonomyLevel?: "SUGGEST_ONLY" | "ACT_WITH_APPROVAL" | "ACT_AUTONOMOUS"; confidenceThreshold?: number }) =>
  prisma.agent.update({ where: { id: agentId }, data });

async function call(name: string, input: Record<string, unknown>) {
  const { grant } = await createGrant({
    agentId,
    workspaceId,
    scopes: ["board:read", "card:read", "card:write", "card:create"],
    ttlSeconds: 600,
    issuedByActorId: adminActorId,
  });
  return callTool(name, input, { grantId: grant.id, onBehalfOfActorId: adminActorId }) as Promise<Record<string, unknown>>;
}

async function newCard(title: string, onBoard = boardId) {
  const listId = onBoard === boardId ? todo : (await prisma.list.findFirstOrThrow({ where: { boardId: onBoard } })).id;
  const c = (await api("POST", `/lists/${listId}/cards`, { title })).body;
  await prisma.card.update({ where: { id: c.id }, data: { assigneeId: agentActorId } });
  return c as { id: string; number: number };
}

const listTitleOf = async (cardId: string) =>
  (await prisma.card.findUniqueOrThrow({ where: { id: cardId }, include: { list: true } })).list.title;

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await api("POST", "/auth/signup", { email: `auto-a-${tag}@test.dev`, password: "testpass123", name: "Admin" });
  await api("POST", "/auth/signup", { email: `auto-m-${tag}@test.dev`, password: "testpass123", name: "Member" }, "member");
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  adminActorId = (await prisma.user.findUniqueOrThrow({ where: { email: `auto-a-${tag}@test.dev` } })).actorId;
  memberActorId = (await prisma.user.findUniqueOrThrow({ where: { email: `auto-m-${tag}@test.dev` } })).actorId;
  created.push(adminActorId, memberActorId, (await api("GET", "/workspaces", undefined, "member")).body[0].id);
  await prisma.membership.create({ data: { actorId: memberActorId, workspaceId, role: "MEMBER" } });

  boardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Trust Board" })).body.id;
  todo = (await api("POST", `/boards/${boardId}/lists`, { title: "To Do" })).body.id;
  await api("POST", `/boards/${boardId}/lists`, { title: "Done" });
  otherBoardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Payments" })).body.id;
  await api("POST", `/boards/${otherBoardId}/lists`, { title: "To Do" });
  await api("POST", `/boards/${otherBoardId}/lists`, { title: "Done" });

  const reg = await api("POST", `/workspaces/${workspaceId}/agents`, {
    displayName: "Careful bot",
    modelProvider: "external",
    allowedScopes: ["board:read", "card:read", "card:write", "card:create"],
  });
  agentId = reg.body.agent.id;
  agentActorId = reg.body.agent.actorId;
  expect(reg.body.agent.autonomyLevel).toBe("ACT_WITH_APPROVAL"); // the cautious default
  await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/activate`);
}, 240_000);

afterAll(async () => {
  server?.close();
  await deleteWorkspaces(workspaceId, created[2]);
  await deleteActors(adminActorId, memberActorId, agentActorId);
});

describe("SUGGEST_ONLY", () => {
  it("queues the change instead of making it, then applies it on approval", async () => {
    await setAgent({ autonomyLevel: "SUGGEST_ONLY" });
    const card = await newCard("Suggest me");
    const out = await call("move_ticket", { cardId: card.id, column: "Done", reasoning: "tests pass" });
    expect(out).toMatchObject({ status: "PENDING_APPROVAL", change: expect.stringContaining('to "Done"') });
    expect(await listTitleOf(card.id)).toBe("To Do"); // nothing happened yet
    const pending = await prisma.auditEntry.findFirst({ where: { workspaceId, targetId: card.id, result: "PENDING_APPROVAL" } });
    expect(pending?.reasoningSummary).toBe("tests pass");

    const r = await api("POST", `/reviews/${out.reviewId}/approve`);
    expect(r.status).toBe(200);
    expect(await listTitleOf(card.id)).toBe("Done");
    // It ran AS the agent, on the approver's authority.
    const ran = await prisma.auditEntry.findFirst({
      where: { workspaceId, targetId: card.id, action: "AGENT.MOVE_TICKET", result: "SUCCESS" },
    });
    expect(ran).toMatchObject({ actorId: agentActorId, onBehalfOfActorId: adminActorId });
  }, 120_000);

  it("only queues what would work: a bad column fails now, and leaves nothing behind", async () => {
    const card = await newCard("Bad column");
    const before = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
    const err = await call("move_ticket", { cardId: card.id, column: "Nowhere" }).then(() => null, (e) => e);
    expect((err as ToolError).code).toBe("NOT_FOUND");
    expect(await prisma.confidenceReview.count({ where: { cardId: card.id } })).toBe(0);

    // A queued create_task is dry-run too, and the rollback returns its card number.
    const q = await call("create_task", { boardId, column: "To Do", title: "Queued card" });
    expect(q.status).toBe("PENDING_APPROVAL");
    const after = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
    expect(after.nextCardNumber).toBe(before.nextCardNumber);
  }, 120_000);

  it("never gates talking: comments go straight through", async () => {
    const card = await newCard("Chatty");
    const out = await call("add_comment", { cardId: card.id, body: "Blocked on credentials" });
    expect(out.commentId).toBeTruthy();
  }, 60_000);
});

describe("ACT_WITH_APPROVAL", () => {
  it("acts at or above the threshold, queues below it or with no confidence", async () => {
    await setAgent({ autonomyLevel: "ACT_WITH_APPROVAL", confidenceThreshold: 0.8 });
    const sure = await newCard("Sure");
    expect((await call("move_ticket", { cardId: sure.id, column: "Done", confidence: 0.9 })).status).toBeUndefined();
    expect(await listTitleOf(sure.id)).toBe("Done");
    const entry = await prisma.auditEntry.findFirst({ where: { targetId: sure.id, action: "AGENT.MOVE_TICKET" } });
    expect(entry?.confidence).toBe(0.9); // the stated confidence is on the record

    const unsure = await newCard("Unsure");
    const low = await call("move_ticket", { cardId: unsure.id, column: "Done", confidence: 0.5 });
    expect(low).toMatchObject({ status: "PENDING_APPROVAL", why: "confidence 50% is below 80%" });
    const none = await call("move_ticket", { cardId: unsure.id, column: "Done" });
    expect(none.why).toMatch(/no confidence given/);
    expect(await listTitleOf(unsure.id)).toBe("To Do");
  }, 120_000);

  it("rejects an out-of-range confidence as bad input", async () => {
    const card = await newCard("Range");
    const err = await call("move_ticket", { cardId: card.id, column: "Done", confidence: 7 }).then(() => null, (e) => e);
    expect((err as ToolError).code).toBe("INVALID_INPUT");
  }, 60_000);
});

describe("policies and card thresholds", () => {
  it("a per-board policy overrides the agent's default", async () => {
    await setAgent({ autonomyLevel: "ACT_AUTONOMOUS" });
    const r = await api("PUT", `/workspaces/${workspaceId}/agents/${agentId}/autonomy/boards/${otherBoardId}`, {
      level: "SUGGEST_ONLY",
    });
    expect(r.status).toBe(200);
    const pay = await newCard("Refund flow", otherBoardId);
    expect((await call("move_ticket", { cardId: pay.id, column: "Done", confidence: 1 })).status).toBe("PENDING_APPROVAL");
    const free = await newCard("Docs tweak");
    expect((await call("move_ticket", { cardId: free.id, column: "Done" })).status).toBeUndefined();
  }, 120_000);

  it("a card's own reviewThreshold binds even an autonomous agent", async () => {
    const card = await newCard("Sensitive");
    await api("PATCH", `/cards/${card.id}`, { reviewThreshold: 0.95 });
    const out = await call("update_ticket", { cardId: card.id, priority: "URGENT", confidence: 0.9 });
    expect(out).toMatchObject({ status: "PENDING_APPROVAL", why: "confidence 90% is below 95%" });
    expect((await call("update_ticket", { cardId: card.id, priority: "URGENT", confidence: 0.97 })).status).toBeUndefined();
  }, 120_000);
});

describe("approval re-checks and decisions", () => {
  it("won't run a queued change for an agent suspended since: FAILED, card untouched", async () => {
    await setAgent({ autonomyLevel: "SUGGEST_ONLY" });
    const card = await newCard("Queued then suspended");
    const out = await call("move_ticket", { cardId: card.id, column: "Done" });
    await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/suspend`);

    const r = await api("POST", `/reviews/${out.reviewId}/approve`);
    expect(r.status).toBe(409);
    expect(await listTitleOf(card.id)).toBe("To Do");
    expect((await prisma.confidenceReview.findUniqueOrThrow({ where: { id: String(out.reviewId) } })).status).toBe("FAILED");
    await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/activate`);
  }, 120_000);

  it("a rejection reaches the agent with the reviewer's note", async () => {
    const card = await newCard("Reject me");
    const out = await call("move_ticket", { cardId: card.id, column: "Done" });
    expect((await api("POST", `/reviews/${out.reviewId}/reject`, { note: "Needs a test first" })).status).toBe(200);
    expect((await api("POST", `/reviews/${out.reviewId}/approve`)).status).toBe(409); // decided once
    const mine = (await call("list_my_tasks", {})) as { yourQueuedChanges: { reviewId: string; status: string; reviewerNote?: string }[] };
    expect(mine.yourQueuedChanges.find((r) => r.reviewId === out.reviewId)).toMatchObject({
      status: "REJECTED",
      reviewerNote: "Needs a test first",
    });
  }, 120_000);
});

describe("G11 — only owners and admins govern agents", () => {
  it("a MEMBER can see the queue but not decide, register agents or change autonomy", async () => {
    const card = await newCard("Member tries");
    const out = await call("move_ticket", { cardId: card.id, column: "Done" });
    expect((await api("GET", `/workspaces/${workspaceId}/reviews?status=PENDING`, undefined, "member")).status).toBe(200);
    expect((await api("POST", `/reviews/${out.reviewId}/approve`, undefined, "member")).status).toBe(403);
    expect(
      (await api("POST", `/workspaces/${workspaceId}/agents`, { displayName: "x", modelProvider: "x", allowedScopes: ["card:read"] }, "member")).status,
    ).toBe(403);
    expect((await api("PATCH", `/workspaces/${workspaceId}/agents/${agentId}/autonomy`, { level: "ACT_AUTONOMOUS" }, "member")).status).toBe(403);
    expect(await listTitleOf(card.id)).toBe("To Do");
  }, 120_000);
});

it("advertises confidence/reasoning only on gated tools", () => {
  const all = describeTools(["board:read", "card:read", "card:write", "card:create", "card:assign"]);
  const props = (n: string) => Object.keys((all.find((t) => t.name === n)!.inputSchema as { properties: object }).properties);
  expect(props("move_ticket")).toEqual(expect.arrayContaining(["confidence", "reasoning"]));
  expect(props("add_comment")).not.toContain("confidence");
  expect(props("get_ticket")).not.toContain("confidence");
});
