// Login rate limiting (G10): 5 failures per email in 15 minutes lock that
// email; the lock holds even against the right password; success clears the
// count; other accounts are unaffected; the lock expires.

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { MAX_FAILURES, WINDOW_MS, throttleKey } from "../src/lib/loginThrottle.js";
import { deleteActors, deleteWorkspaces } from "./cleanup.js";

const tag = Date.now().toString(36);
const PASSWORD = "rightpass123";
const emails = { ana: `ana-${tag}@test.dev`, ben: `ben-${tag}@test.dev`, cy: `cy-${tag}@test.dev` };
let server: HttpServer;
let base: string;

async function post(path: string, body: unknown) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, retryAfter: res.headers.get("retry-after"), body: await res.json() };
}
const login = (email: string, password: string) => post("/auth/login", { email, password });

beforeAll(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const [name, email] of Object.entries(emails)) {
    await post("/auth/signup", { email, password: PASSWORD, name });
  }
});

afterAll(async () => {
  server?.close();
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(emails) } }, select: { actorId: true } });
  const actorIds = users.map((u) => u.actorId);
  const memberships = await prisma.membership.findMany({ where: { actorId: { in: actorIds } }, select: { workspaceId: true } });
  await deleteWorkspaces(...memberships.map((m) => m.workspaceId));
  await deleteActors(...actorIds);
  await prisma.loginFailure.deleteMany({ where: { email: { in: Object.values(emails).map(throttleKey) } } });
});

describe("login rate limit", () => {
  it(`locks an email after ${MAX_FAILURES} wrong passwords — even the right one is refused`, async () => {
    for (let i = 0; i < MAX_FAILURES; i++) {
      expect((await login(emails.ana, "wrong-guess")).status).toBe(401);
    }
    const locked = await login(emails.ana, PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatch(/Too many failed attempts\. Try again in \d+ minutes?\./);
    expect(Number(locked.retryAfter)).toBeGreaterThan(0);
    expect(Number(locked.retryAfter)).toBeLessThanOrEqual(WINDOW_MS / 1000);

    // Another account is unaffected.
    expect((await login(emails.ben, PASSWORD)).status).toBe(200);
  });

  it("counts different capitalisations of the same email together", async () => {
    // Ana is already locked; a case variant is locked too.
    expect((await login(emails.ana.toUpperCase(), PASSWORD)).status).toBe(429);
  });

  it("unlocks once the failures are older than the window", async () => {
    await prisma.loginFailure.updateMany({
      where: { email: throttleKey(emails.ana) },
      data: { createdAt: new Date(Date.now() - WINDOW_MS - 60_000) },
    });
    expect((await login(emails.ana, PASSWORD)).status).toBe(200);
  });

  it("a successful login clears the count", async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) await login(emails.cy, "wrong-guess");
    expect((await login(emails.cy, PASSWORD)).status).toBe(200);
    // Without the reset, the next failure would be the 5th and this the 6th.
    for (let i = 0; i < MAX_FAILURES - 1; i++) {
      expect((await login(emails.cy, "wrong-guess")).status).toBe(401);
    }
    expect((await login(emails.cy, PASSWORD)).status).toBe(200);
  });

  it("counts failures for emails that don't exist, so the lock can't reveal who has an account", async () => {
    const ghost = `ghost-${tag}@test.dev`;
    for (let i = 0; i < MAX_FAILURES; i++) expect((await login(ghost, "x")).status).toBe(401);
    expect((await login(ghost, "x")).status).toBe(429);
    await prisma.loginFailure.deleteMany({ where: { email: throttleKey(ghost) } });
  });
});
