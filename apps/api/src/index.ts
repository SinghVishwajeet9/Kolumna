import cors from "cors";
import express from "express";
import type { HealthCheck } from "@kolumna/shared";
import { env } from "./lib/env";

const app = express();

// --- Global middleware ---------------------------------------------------
// Runs on every request, before any route handler. See CONCEPTS.md §2.9.

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true, // required for cookies once auth exists (Day 4)
  }),
);
app.use(express.json());

// --- Routes ----------------------------------------------------------------
// Day 1: just prove the server boots and the shared package resolves.
// Real routes (auth, boards, lists, cards) get their own files in
// src/routes/ from Day 4 onward — see ARCHITECTURE.md §4.

app.get("/health", (_req, res) => {
  const body: HealthCheck = { ok: true, service: "api" };
  res.json(body);
});

// --- Start -------------------------------------------------------------

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
