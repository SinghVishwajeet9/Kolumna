// The consumer side of the agent-run queue — a separate long-running
// process from the Express API (run via `bun run worker`, not part of
// `bun run dev`). This is deliberate: a slow or crashing agent run must
// never be able to take down the server handling normal board/card
// requests, which is the whole reason this queue exists in the first place.
//
// The job handler below is a placeholder — proving the queue plumbing works
// end-to-end (a job enqueued by the API is picked up and processed here)
// BEFORE any model/MCP logic is wired in. It gets replaced with the real
// agent loop (load card+agent, call the model via MCP tools, write
// audit/subtask cards) later in Phase 3.

import { Worker } from "bullmq";
import { redisConnection } from "./gateway/redis.js";
import { AGENT_RUN_QUEUE_NAME, type AgentRunJobData } from "./gateway/queue.js";

const worker = new Worker<AgentRunJobData>(
  AGENT_RUN_QUEUE_NAME,
  async (job) => {
    console.log(`[worker] processing job ${job.id}:`, job.data);
    return { ok: true };
  },
  { connection: redisConnection },
);

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log(`[worker] listening for jobs on "${AGENT_RUN_QUEUE_NAME}"`);
