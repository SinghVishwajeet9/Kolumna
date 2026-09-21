import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

export async function requireWorkspaceMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const workspaceId = req.params.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ error: "Missing workspaceId parameter" });
    }
    const membership = await prisma.membership.findUnique({
      where: {
        actorId_workspaceId: {
          actorId: req.user.actorId,
          workspaceId: workspaceId,
        },
      },
    });
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this workspace" });
    }
    req.ctx = { workspaceId, actorId: req.user.actorId };
    next();
  } catch (err) {
    next(err);
  }
}
