// A database failure inside a route must become a 500 response, not a crashed
// process. Express 4 doesn't catch rejections from async handlers by itself;
// asyncHandler (lib/asyncHandler.ts) does. Found while preparing to host: a
// dropped DB connection during signup killed the whole API.

import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

let server: HttpServer;
let base: string;

beforeAll(() => {
  // The error handler logs each simulated failure with a stack trace; that's
  // expected here, so keep it out of the test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  vi.restoreAllMocks();
  server?.close();
});

describe("a failing database", () => {
  it.each([
    ["POST", "/auth/signup", { email: "nobody@test.dev", password: "testpass123", name: "Nobody" }],
    ["POST", "/auth/login", { email: "nobody@test.dev", password: "testpass123" }],
  ])("%s %s answers 500 and the server keeps serving", async (method, path, body) => {
    vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("connection terminated"));
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(500);

    // Still alive afterwards.
    const health = await fetch(base + "/health");
    expect(health.status).toBe(200);
  });

  it("GET /auth/me with a cookie whose session lookup fails answers 500", async () => {
    vi.spyOn(prisma.session, "findUnique").mockRejectedValueOnce(new Error("connection terminated"));
    const res = await fetch(base + "/auth/me", { headers: { cookie: "kolumna_session=whatever" } });
    expect(res.status).toBe(500);
  });
});
