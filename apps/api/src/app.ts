// The Express app, without starting a server — index.ts listens, and tests
// mount this same app on a throwaway port.

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { HealthCheck } from "@kolumna/shared";
import { env } from "./lib/env.js";
import authRoutes from "./routes/auth.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import boardRoutes from "./routes/board.routes.js";
import listRoutes from "./routes/list.routes.js";
import cardRoutes from "./routes/card.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import proposalRoutes from "./routes/proposal.routes.js";
import cardDetailRoutes from "./routes/cardDetail.routes.js";
import agentRoutes from "./gateway/agent.routes.js";
import agentAuthRoutes from "./gateway/agentAuth.routes.js";
import mcpRoutes from "./gateway/mcp.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

// --- Global middleware ---------------------------------------------------
// Runs on every request, before any route handler. See CONCEPTS.md §2.9.

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true, // required for cookies — see CONCEPTS.md §2.7
  }),
);
app.use(express.json());
app.use(cookieParser()); // populates req.cookies — needed to read the session cookie

// --- Routes ----------------------------------------------------------------

app.get("/health", (_req, res) => {
  const body: HealthCheck = { ok: true, service: "api" };
  res.json(body);
});

app.use("/auth", authRoutes);
app.use("/workspaces", workspaceRoutes);
// board/list routes already contain full paths (e.g. /workspaces/:id/boards,
// /boards/:id) internally — mounted at root so those paths aren't doubled.
app.use(boardRoutes);
app.use(listRoutes);
app.use(cardRoutes);
app.use(auditRoutes);
app.use(proposalRoutes);
app.use(cardDetailRoutes);
app.use(agentRoutes);
app.use(agentAuthRoutes);
app.use(mcpRoutes);

// Must be registered LAST — after every route — see errorHandler.ts.
app.use(errorHandler);
