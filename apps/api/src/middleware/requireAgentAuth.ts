// Bearer-token auth for agents — the agent equivalent of requireAuth, but
// agents never have a session cookie. They authenticate with the short-lived
// token issued by POST /agent-auth/token. See gateway/agentGrant.repo.ts.

import type { Request, Response, NextFunction } from "express";
import { findValidGrantByToken } from "../gateway/agentGrant.repo.js";

export async function requireAgentAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const token = header.slice("Bearer ".length);
    const grant = await findValidGrantByToken(token);
    if (!grant) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    if (grant.agent.status !== "ACTIVE") {
      return res.status(403).json({ error: "Agent is not active" });
    }

    req.agentGrant = grant;
    next();
  } catch (err) {
    next(err);
  }
}
