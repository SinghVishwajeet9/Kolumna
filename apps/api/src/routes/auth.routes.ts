import { z } from "zod";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import {
  generateSessionToken,
  createSession,
  validateSessionToken,
  invalidateSession,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "../lib/session.js";
import argon2 from "argon2";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const { email, password, name } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const hashedPassword = await argon2.hash(password);

  const { user, workspace } = await prisma.$transaction(async (tx) => {
    // Every human gets an Actor(HUMAN) backing it — Membership and Card
    // assignment reference the actor, not the user, from here on.
    const actor = await tx.actor.create({
      data: { type: "HUMAN", displayName: name },
    });
    const user = await tx.user.create({
      data: {
        actorId: actor.id,
        email,
        hashedPassword,
        name,
      },
    });
    const workspace = await tx.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${user.id.slice(0, 6)}`,
        members: {
          create: { actorId: actor.id, role: "OWNER" },
        },
      },
    });
    return { user, workspace };
  });

  const token = generateSessionToken();
  const session = await createSession(token, user.id);
  setSessionCookie(res, token, session.expiresAt);

  res.status(201).json({
    message: "User created successfully",
    user: { id: user.id, email: user.email, name: user.name },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const parsed = z
    .object({ email: z.string().email(), password: z.string() })
    .safeParse({ email, password });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await argon2.verify(user.hashedPassword, password))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = generateSessionToken();
  const session = await createSession(token, user.id);
  setSessionCookie(res, token, session.expiresAt);

  res.status(200).json({
    message: "Login successful",
    user: { id: user.id, email: user.email, name: user.name },
  });
});

router.post("/logout", async (req, res) => {
  const token = req.cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return res.status(200).json({ message: "Logged out" });
  }

  await invalidateSession(token);
  clearSessionCookie(res);

  res.status(200).json({ message: "Logged out" });
});

router.get("/me", async (req, res) => {
  const token = req.cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const user = await validateSessionToken(token);
  if (!user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  res.status(200).json({
    user: { id: user.id, email: user.email, name: user.name },
  });
});

export default router;
