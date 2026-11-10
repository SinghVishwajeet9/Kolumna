// Team invites and membership management — over real HTTP, with three
// separate sessions (the owner, an invitee, an outsider).

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { deleteActors } from "./cleanup.js";

const tag = Date.now().toString(36);
let server: HttpServer;
let base: string;
const cookies: Record<string, string> = { owner: "", ana: "", eve: "" };
const email = (who: string) => `${who}-${tag}@test.dev`;
let workspaceId: string;
let boardId: string;
const actor: Record<string, string> = {};

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

const tokenOf = (url: string) => url.split("/invite/")[1]!;

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const who of ["owner", "ana", "eve"]) {
    await api("POST", "/auth/signup", { email: email(who), password: "testpass123", name: who }, who);
    actor[who] = (await prisma.user.findUniqueOrThrow({ where: { email: email(who) } })).actorId;
  }
  workspaceId = (await api("GET", "/workspaces")).body[0].id;
  boardId = (await api("POST", `/workspaces/${workspaceId}/boards`, { title: "Team Board" })).body.id;
}, 120_000);

afterAll(async () => {
  server?.close();
  const ids = Object.values(actor);
  await prisma.workspace.deleteMany({ where: { members: { some: { actorId: { in: ids }, role: "OWNER" } } } });
  await deleteActors(...ids);
});

describe("invites", () => {
  let link: string;

  it("an admin invites by email and gets a one-time link; only its hash is stored", async () => {
    const r = await api("POST", `/workspaces/${workspaceId}/invites`, { email: email("ana").toUpperCase(), role: "MEMBER" });
    expect(r.status).toBe(201);
    expect(r.body.email).toBe(email("ana")); // normalised
    link = r.body.url;
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{20,}$/);

    const stored = await prisma.workspaceInvite.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(stored.tokenHash).not.toContain(tokenOf(link));
    expect((await api("GET", `/workspaces/${workspaceId}/invites`)).body).toHaveLength(1);
  }, 60_000);

  it("anyone with the link sees what it's for — but only the invited address can accept", async () => {
    const info = await api("GET", `/invites/${tokenOf(link)}`, undefined, "eve");
    expect(info.body).toMatchObject({ workspace: "owner's Workspace", invitedBy: "owner", email: email("ana"), state: "PENDING" });

    const stolen = await api("POST", `/invites/${tokenOf(link)}/accept`, undefined, "eve");
    expect(stolen.status).toBe(403);
    expect(stolen.body.error).toMatch(/This invite is for/);
    expect(await prisma.membership.count({ where: { workspaceId, actorId: actor.eve! } })).toBe(0);
  }, 60_000);

  it("accepting makes them a member with the invited role, once", async () => {
    const r = await api("POST", `/invites/${tokenOf(link)}/accept`, undefined, "ana");
    expect(r.body).toMatchObject({ workspaceId, role: "MEMBER" });
    const m = await prisma.membership.findUniqueOrThrow({ where: { actorId_workspaceId: { actorId: actor.ana!, workspaceId } } });
    expect(m.role).toBe("MEMBER");
    expect((await api("GET", `/boards/${boardId}`, undefined, "ana")).status).toBe(200); // can see the team's board

    expect((await api("POST", `/invites/${tokenOf(link)}/accept`, undefined, "ana")).status).toBe(409);
    expect((await api("GET", `/invites/${tokenOf(link)}`)).body.state).toBe("ACCEPTED");
    const join = await prisma.auditEntry.findFirst({ where: { workspaceId, action: "MEMBER.JOIN" } });
    expect(join?.actorId).toBe(actor.ana);
  }, 60_000);

  it("won't invite an existing member; a new link replaces the old one; links expire", async () => {
    expect((await api("POST", `/workspaces/${workspaceId}/invites`, { email: email("ana") })).status).toBe(409);

    const first = (await api("POST", `/workspaces/${workspaceId}/invites`, { email: email("eve") })).body;
    const second = (await api("POST", `/workspaces/${workspaceId}/invites`, { email: email("eve") })).body;
    expect((await api("GET", `/invites/${tokenOf(first.url)}`)).body.state).toBe("REVOKED");

    await prisma.workspaceInvite.update({ where: { id: second.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api("POST", `/invites/${tokenOf(second.url)}/accept`, undefined, "eve")).status).toBe(409);
  }, 60_000);

  it("members can't invite; garbage links are just invalid", async () => {
    expect((await api("POST", `/workspaces/${workspaceId}/invites`, { email: "x@test.dev" }, "ana")).status).toBe(403);
    expect((await api("GET", "/invites/not-a-real-token")).status).toBe(404);
  }, 60_000);
});

describe("managing members", () => {
  it("only an owner hands out ownership, and the last owner can't be demoted", async () => {
    await api("PATCH", `/workspaces/${workspaceId}/members/${actor.ana}`, { role: "ADMIN" });
    expect((await api("PATCH", `/workspaces/${workspaceId}/members/${actor.ana}`, { role: "OWNER" }, "ana")).status).toBe(403);
    const demoteSelf = await api("PATCH", `/workspaces/${workspaceId}/members/${actor.owner}`, { role: "MEMBER" });
    expect(demoteSelf.status).toBe(409);
    expect((await api("DELETE", `/workspaces/${workspaceId}/members/${actor.owner}`)).status).toBe(409); // can't leave as last owner
  }, 60_000);

  it("removing someone unassigns their cards and cuts their access immediately", async () => {
    const list = (await api("POST", `/boards/${boardId}/lists`, { title: "To Do" })).body.id;
    const card = (await api("POST", `/lists/${list}/cards`, { title: "Ana's task" })).body.id;
    await api("PATCH", `/cards/${card}`, { assigneeId: actor.ana });

    expect((await api("DELETE", `/workspaces/${workspaceId}/members/${actor.ana}`)).status).toBe(204);
    expect((await prisma.card.findUniqueOrThrow({ where: { id: card } })).assigneeId).toBeNull();
    expect((await api("GET", `/boards/${boardId}`, undefined, "ana")).status).toBe(404);
    const removed = await prisma.auditEntry.findFirst({ where: { workspaceId, action: "MEMBER.REMOVE" } });
    expect(removed?.resource).toMatch(/1 cards unassigned/);
  }, 120_000);
});
