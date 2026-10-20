// G11 — least privilege for governance actions. Registering and managing
// agents, setting their autonomy, and approving what they asked to do are
// OWNER/ADMIN decisions; any member can still work the board.

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { ForbiddenError } from "../lib/errors.js";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN"]);

export async function isWorkspaceAdmin(actorId: string, workspaceId: string) {
  const m = await prisma.membership.findUnique({
    where: { actorId_workspaceId: { actorId, workspaceId } },
    select: { role: true },
  });
  return !!m && ADMIN_ROLES.has(m.role);
}

/** For routes that find the workspace from a resource (a proposal, a review). */
export async function assertWorkspaceAdmin(actorId: string, workspaceId: string) {
  if (!(await isWorkspaceAdmin(actorId, workspaceId))) {
    throw new ForbiddenError("Only workspace owners and admins can do this");
  }
}

/** Drop-in for requireWorkspaceMember on /workspaces/:workspaceId/... routes. */
export async function requireWorkspaceAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not logged in" });
    const workspaceId = req.params.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId parameter" });
    const m = await prisma.membership.findUnique({
      where: { actorId_workspaceId: { actorId: req.user.actorId, workspaceId } },
      select: { role: true },
    });
    if (!m) return res.status(403).json({ error: "Not a member of this workspace" });
    if (!ADMIN_ROLES.has(m.role)) {
      return res.status(403).json({ error: "Only workspace owners and admins can do this" });
    }
    req.ctx = { workspaceId, actorId: req.user.actorId };
    next();
  } catch (err) {
    next(err);
  }
}
