// TypeScript declaration merging: this extends Express's own Request type
// with the two fields our middleware attaches, so `req.user` and `req.ctx`
// are typed everywhere in every route handler, with no casting needed.
//
// This file has no imports/exports of its own logic — it just adds fields
// to a type that already exists elsewhere. That's what makes it a ".d.ts"
// (declaration file) rather than a normal ".ts" file.

import type { User } from "../generated/prisma/client.js";
import type { TenantContext } from "../lib/tenant-context.js";
import type { findValidGrantByToken } from "../gateway/agentGrant.repo.js";

type AgentGrantWithAgent = NonNullable<Awaited<ReturnType<typeof findValidGrantByToken>>>;

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth once the session cookie is validated. */
      user?: User;
      /** Set by requireWorkspaceMember once membership is confirmed. */
      ctx?: TenantContext;
      /** Set by requireAgentAuth once the agent's bearer token is validated. */
      agentGrant?: AgentGrantWithAgent;
    }
  }
}
