// Team membership: inviting humans by link, accepting, changing roles,
// removing people. Agents join through registration (agent.routes) and leave
// through revocation — not through these routes.
//
// Rules:
//   - inviting, role changes and removals are OWNER/ADMIN (G11)
//   - only an OWNER can make or unmake an OWNER; a workspace always keeps one
//   - an invite link works once, for 7 days, and only for the invited email
//   - anyone may leave a workspace themselves (unless they're its last owner)

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireWorkspaceAdmin } from "../middleware/requireWorkspaceAdmin.js";
import { appendAuditEntry, AUDIT_TX_OPTIONS } from "../lib/audit.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import { generateAccessToken, hashSecret } from "../gateway/credentials.js";

const router = Router();
const INVITE_TTL_MS = 7 * 86_400_000;

const normalizeEmail = (e: string) => e.trim().toLowerCase();

function inviteState(i: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }) {
  if (i.acceptedAt) return "ACCEPTED" as const;
  if (i.revokedAt) return "REVOKED" as const;
  if (i.expiresAt.getTime() <= Date.now()) return "EXPIRED" as const;
  return "PENDING" as const;
}

// --- Inviting ----------------------------------------------------------------

router.post("/workspaces/:workspaceId/invites", requireAuth, requireWorkspaceAdmin, async (req, res, next) => {
  try {
    const parsed = z
      .object({ email: z.string().email().max(254), role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER") })
      .safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const workspaceId = req.ctx!.workspaceId;
    const email = normalizeEmail(parsed.data.email);

    const existing = await prisma.membership.findFirst({
      where: { workspaceId, actor: { user: { email: { equals: email, mode: "insensitive" } } } },
    });
    if (existing) throw new ConflictError(`${email} is already a member of this workspace`);

    const token = generateAccessToken();
    const invite = await prisma.$transaction(async (tx) => {
      // A fresh invite replaces any still-pending one for the same address,
      // so only the newest link works.
      await tx.workspaceInvite.updateMany({
        where: { workspaceId, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const i = await tx.workspaceInvite.create({
        data: {
          workspaceId,
          email,
          role: parsed.data.role,
          tokenHash: hashSecret(token),
          invitedByActorId: req.ctx!.actorId,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      await appendAuditEntry(tx, {
        workspaceId,
        actorId: req.ctx!.actorId,
        action: "MEMBER.INVITE",
        targetType: "WorkspaceInvite",
        targetId: i.id,
        result: "SUCCESS",
        resource: `${email} as ${i.role}`,
      });
      return i;
    }, AUDIT_TX_OPTIONS);

    // The raw token exists only in this response — it can't be shown again.
    res.status(201).json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      url: `${env.webUrl}/invite/${token}`,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/workspaces/:workspaceId/invites", requireAuth, requireWorkspaceAdmin, async (req, res, next) => {
  try {
    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: req.ctx!.workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    res.json(invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt })));
  } catch (err) {
    next(err);
  }
});

router.delete("/workspaces/:workspaceId/invites/:inviteId", requireAuth, requireWorkspaceAdmin, async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const revoked = await tx.workspaceInvite.updateMany({
        where: { id: req.params.inviteId!, workspaceId: req.ctx!.workspaceId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 0) throw new NotFoundError("No pending invite with that id");
      await appendAuditEntry(tx, {
        workspaceId: req.ctx!.workspaceId,
        actorId: req.ctx!.actorId,
        action: "MEMBER.INVITE_REVOKE",
        targetType: "WorkspaceInvite",
        targetId: req.params.inviteId!,
        result: "SUCCESS",
      });
    }, AUDIT_TX_OPTIONS);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Accepting ------------------------------------------------------------------

async function findInvite(token: string) {
  return prisma.workspaceInvite.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: { workspace: { select: { id: true, name: true } } },
  });
}

// Public: the invite page shows what you're joining before you sign in.
// Anyone holding the link learns only the workspace name, inviter and the
// address it's for — the same things the link's recipient was sent.
router.get("/invites/:token", async (req, res, next) => {
  try {
    const invite = await findInvite(req.params.token!);
    if (!invite) throw new NotFoundError("This invite link isn't valid");
    const inviter = await prisma.actor.findUnique({ where: { id: invite.invitedByActorId }, select: { displayName: true } });
    res.json({
      workspace: invite.workspace.name,
      invitedBy: inviter?.displayName ?? "Someone",
      email: invite.email,
      role: invite.role,
      state: inviteState(invite),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/invites/:token/accept", requireAuth, async (req, res, next) => {
  try {
    const invite = await findInvite(req.params.token!);
    if (!invite) throw new NotFoundError("This invite link isn't valid");
    const state = inviteState(invite);
    if (state !== "PENDING") throw new ConflictError(`This invite is ${state.toLowerCase()}`);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    // The link was sent to one person. Holding it isn't enough — you have to
    // be signed in as that address.
    if (normalizeEmail(user.email) !== invite.email) {
      throw new ForbiddenError(`This invite is for ${invite.email}. You're signed in as ${user.email}.`);
    }

    await prisma.$transaction(async (tx) => {
      // Conditional = one use: two tabs accepting at once can't both succeed.
      const claimed = await tx.workspaceInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date(), acceptedByActorId: user.actorId },
      });
      if (claimed.count === 0) throw new ConflictError("This invite was just used or revoked");
      await tx.membership.upsert({
        where: { actorId_workspaceId: { actorId: user.actorId, workspaceId: invite.workspaceId } },
        create: { actorId: user.actorId, workspaceId: invite.workspaceId, role: invite.role },
        update: {}, // already a member (e.g. joined via an older link): keep their role
      });
      await appendAuditEntry(tx, {
        workspaceId: invite.workspaceId,
        actorId: user.actorId,
        action: "MEMBER.JOIN",
        targetType: "WorkspaceInvite",
        targetId: invite.id,
        result: "SUCCESS",
        resource: `as ${invite.role}`,
      });
    }, AUDIT_TX_OPTIONS);

    res.json({ workspaceId: invite.workspace.id, workspace: invite.workspace.name, role: invite.role });
  } catch (err) {
    next(err);
  }
});

// --- Managing members ----------------------------------------------------------

async function loadMembership(workspaceId: string, actorId: string) {
  const m = await prisma.membership.findUnique({
    where: { actorId_workspaceId: { actorId, workspaceId } },
    include: { actor: { select: { type: true, displayName: true } } },
  });
  if (!m) throw new NotFoundError("Not a member of this workspace");
  return m;
}

const ownerCount = (workspaceId: string) => prisma.membership.count({ where: { workspaceId, role: "OWNER" } });

router.patch(
  "/workspaces/:workspaceId/members/:actorId",
  requireAuth,
  requireWorkspaceAdmin,
  async (req, res, next) => {
    try {
      const parsed = z.object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) }).safeParse(req.body);
      if (!parsed.success) throw new ValidationError(parsed.error.message);
      const { workspaceId, actorId: me } = req.ctx!;
      const target = await loadMembership(workspaceId, req.params.actorId!);
      if (target.actor.type === "AGENT") throw new ValidationError("Agents' access is managed on the Agents page");
      const role = parsed.data.role;
      if (role === target.role) return res.json({ actorId: target.actorId, role });

      // Ownership is only granted or taken away by an owner.
      if ((role === "OWNER" || target.role === "OWNER") && (await loadMembership(workspaceId, me)).role !== "OWNER") {
        throw new ForbiddenError("Only an owner can change who owns this workspace");
      }
      if (target.role === "OWNER" && (await ownerCount(workspaceId)) <= 1) {
        throw new ConflictError("A workspace needs at least one owner — make someone else an owner first");
      }

      await prisma.$transaction(async (tx) => {
        await tx.membership.update({ where: { id: target.id }, data: { role } });
        await appendAuditEntry(tx, {
          workspaceId,
          actorId: me,
          action: "MEMBER.ROLE",
          targetType: "Actor",
          targetId: target.actorId,
          result: "SUCCESS",
          resource: `${target.role} -> ${role}`,
        });
      }, AUDIT_TX_OPTIONS);
      res.json({ actorId: target.actorId, role });
    } catch (err) {
      next(err);
    }
  },
);

// Removing someone — or yourself (leaving). Their cards in this workspace are
// unassigned, so nothing stays assigned to a person who can't see it.
router.delete("/workspaces/:workspaceId/members/:actorId", requireAuth, async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId!;
    const me = req.user!.actorId;
    const targetId = req.params.actorId!;
    const mine = await loadMembership(workspaceId, me);
    const leaving = targetId === me;
    if (!leaving && mine.role !== "OWNER" && mine.role !== "ADMIN") {
      throw new ForbiddenError("Only workspace owners and admins can remove members");
    }
    const target = leaving ? mine : await loadMembership(workspaceId, targetId);
    if (target.actor.type === "AGENT") throw new ValidationError("Revoke agents on the Agents page instead");
    if (target.role === "OWNER") {
      if (!leaving && mine.role !== "OWNER") throw new ForbiddenError("Only an owner can remove an owner");
      if ((await ownerCount(workspaceId)) <= 1) {
        throw new ConflictError("A workspace needs at least one owner — make someone else an owner first");
      }
    }

    await prisma.$transaction(async (tx) => {
      const unassigned = await tx.card.updateMany({ where: { workspaceId, assigneeId: target.actorId }, data: { assigneeId: null } });
      await tx.membership.delete({ where: { id: target.id } });
      await appendAuditEntry(tx, {
        workspaceId,
        actorId: me,
        action: leaving ? "MEMBER.LEAVE" : "MEMBER.REMOVE",
        targetType: "Actor",
        targetId: target.actorId,
        result: "SUCCESS",
        resource: `${target.actor.displayName}; ${unassigned.count} cards unassigned`,
      });
    }, AUDIT_TX_OPTIONS);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
