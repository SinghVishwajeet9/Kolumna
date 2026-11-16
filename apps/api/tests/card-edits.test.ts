// Editing and deleting comments and checklist steps, over real HTTP with three
// sessions: the workspace owner, a plain member, and an outsider.

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { deleteActors } from "./cleanup.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
const cookies: Record<string, string> = { owner: "", mia: "", eve: "" };
const email = (who: string) => `${who}-edits-${tag}@test.dev`;
const actor: Record<string, string> = {};
let workspaceId: string;
let cardId: string;

async function api(method: string, path: string, body?: unknown, who = "owner") {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", cookie: cookies[who] ?? "" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookies[who] = setCookie.split(";")[0]!;
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const actions = async () =>
  (await prisma.auditEntry.findMany({ where: { workspaceId }, orderBy: { seq: "asc" } })).map((e) => e.action);

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const who of ["owner", "mia", "eve"]) {
    await api("POST", "/auth/signup", { email: email(who), password: "testpass123", name: who }, who);
    actor[who] = (await prisma.user.findUniqueOrThrow({ where: { email: email(who) } })).actorId;
  }
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  // Mia joins as a plain member.
  const invite = await api("POST", `/workspaces/${workspaceId}/invites`, { email: email("mia"), role: "MEMBER" });
  await api("POST", `/invites/${invite.body.url.split("/invite/")[1]}/accept`, undefined, "mia");

  const board = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Edits", columns: ["To Do", "Done"] })).body;
  const listId = (await api("GET", `/boards/${board.id}`)).body.lists[0].id;
  cardId = (await api("POST", `/lists/${listId}/cards`, { title: "A card" })).body.id;
}, 120_000);

afterAll(async () => {
  server?.close();
  const ids = Object.values(actor);
  await prisma.workspace.deleteMany({ where: { members: { some: { actorId: { in: ids }, role: "OWNER" } } } });
  await deleteActors(...ids);
});

describe("comments", () => {
  let mine: string; // Mia's comment

  it("the author can edit their comment; it's marked edited and audited", async () => {
    mine = (await api("POST", `/cards/${cardId}/comments`, { body: "frist draft" }, "mia")).body.id;
    const r = await api("PATCH", `/comments/${mine}`, { body: "  first draft  " }, "mia");
    expect(r.status).toBe(200);
    expect(r.body.body).toBe("first draft");
    expect(r.body.editedAt).not.toBeNull();
    expect(await actions()).toContain("CARD.COMMENT_EDIT");
  }, 60_000);

  it("nobody else can edit it: not the owner, not an outsider", async () => {
    expect((await api("PATCH", `/comments/${mine}`, { body: "rewritten" })).status).toBe(403);
    expect((await api("PATCH", `/comments/${mine}`, { body: "rewritten" }, "eve")).status).toBe(404);
    expect((await api("PATCH", `/comments/${mine}`, { body: "   " }, "mia")).status).toBe(400);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: mine } })).body).toBe("first draft");
  }, 60_000);

  it("a member can't delete someone else's comment; an outsider can't see it", async () => {
    const owners = (await api("POST", `/cards/${cardId}/comments`, { body: "owner's note" })).body.id;
    expect((await api("DELETE", `/comments/${owners}`, undefined, "mia")).status).toBe(403);
    expect((await api("DELETE", `/comments/${owners}`, undefined, "eve")).status).toBe(404);
    expect(await prisma.comment.count({ where: { id: owners } })).toBe(1);
  }, 60_000);

  it("the author can delete their own, and an owner can delete anyone's", async () => {
    const second = (await api("POST", `/cards/${cardId}/comments`, { body: "another" }, "mia")).body.id;
    expect((await api("DELETE", `/comments/${mine}`, undefined, "mia")).status).toBe(204);
    expect((await api("DELETE", `/comments/${second}`)).status).toBe(204);
    expect(await prisma.comment.count({ where: { id: { in: [mine, second] } } })).toBe(0);
    expect((await actions()).filter((a) => a === "CARD.COMMENT_DELETE")).toHaveLength(2);
    expect((await api("DELETE", `/comments/${mine}`, undefined, "mia")).status).toBe(404);
  }, 60_000);
});

describe("checklist steps", () => {
  let itemId: string;

  it("a step can be reworded without changing whether it's ticked", async () => {
    itemId = (await api("POST", `/cards/${cardId}/checklist`, { title: "Wirte tests" })).body.id;
    await api("PATCH", `/checklist-items/${itemId}`, { done: true });
    const r = await api("PATCH", `/checklist-items/${itemId}`, { title: "Write tests" }, "mia");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ title: "Write tests", done: true });
    expect(await actions()).toContain("CHECKLIST.RENAME");
  }, 60_000);

  it("ticking still works alone, and an empty request or title is refused", async () => {
    const r = await api("PATCH", `/checklist-items/${itemId}`, { done: false });
    expect(r.body).toMatchObject({ title: "Write tests", done: false });
    expect((await api("PATCH", `/checklist-items/${itemId}`, {})).status).toBe(400);
    expect((await api("PATCH", `/checklist-items/${itemId}`, { title: "  " })).status).toBe(400);
  }, 60_000);

  it("a step can be deleted by a member, not by an outsider, and it's audited", async () => {
    expect((await api("DELETE", `/checklist-items/${itemId}`, undefined, "eve")).status).toBe(404);
    expect((await api("DELETE", `/checklist-items/${itemId}`, undefined, "mia")).status).toBe(204);
    expect(await prisma.checklistItem.count({ where: { id: itemId } })).toBe(0);
    expect(await actions()).toContain("CHECKLIST.REMOVE");
    expect((await api("GET", `/workspaces/${workspaceId}/audit/verify`)).body.valid).toBe(true);
  }, 60_000);
});
