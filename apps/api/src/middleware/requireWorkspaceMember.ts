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
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.user.id,
          workspaceId: workspaceId,
        },
      },
    });
    if (!workspaceMember) {
      return res.status(403).json({ error: "Not a member of this workspace" });
    }
    req.ctx = { workspaceId, userId: req.user.id };
    next();
  } catch (err) {
    next(err);
  }
}
// 1. defensive check: if (!req.user) → 401 (shouldn't happen if requireAuth ran first, but don't assume)

// 2. get workspaceId from req.params.workspaceId (the route will look like
//    /workspaces/:workspaceId/boards)

// 3. query WorkspaceMember: find one where userId = req.user.id AND workspaceId = that param
//    (use findUnique against your @@unique([userId, workspaceId]) constraint —
//    that's exactly the index Prisma needs for this lookup)

// 4. if not found → 403 (they're logged in, just not allowed into THIS workspace)

// 5. if found → build the TenantContext ({ workspaceId, userId }) and attach
//    it as req.ctx, then next()
