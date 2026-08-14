import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { HealthCheck } from "@kolumna/shared";
import { env } from "./lib/env";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

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

// Must be registered LAST — after every route — see errorHandler.ts.
app.use(errorHandler);

// --- Start -------------------------------------------------------------

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
