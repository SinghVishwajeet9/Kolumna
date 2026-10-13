// The producer side of the agent-run queue. Route handlers import
// `agentRunQueue` and call `.add(...)` to hand off work; they never run an
// agent inline. worker.ts is the consumer side that actually processes jobs.
//
// The job payload is intentionally the minimal "what to do," not "how to do
// it" — the worker looks everything else (the card, the agent, its grant)
// up fresh when it runs, so a job sitting in the queue for a while doesn't
// go stale.

import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export const AGENT_RUN_QUEUE_NAME = "agent-runs";

export type AgentRunJobData = {
  workspaceId: string;
  agentId: string;
  cardId: string;
  requestedByActorId: string;
};

export const agentRunQueue = new Queue<AgentRunJobData>(AGENT_RUN_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    // Without these, BullMQ keeps every finished job in Redis forever.
    // Failed jobs are kept longer — they're what you debug from.
    removeOnComplete: { age: 24 * 60 * 60 },
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  },
});
