// The one shared Redis connection everything in the gateway's queue system
// uses — a Queue (producer side, in the API routes) and a Worker (consumer
// side, in worker.ts) both need a connection to the same Redis instance.
//
// `maxRetriesPerRequest: null` is not optional here — BullMQ's Worker polls
// with blocking Redis commands under the hood, and ioredis's own built-in
// retry-per-request logic actively conflicts with that, producing spurious
// "max retries per request" errors under completely normal operation. This
// is a BullMQ-mandated setting, not a tuning choice.

import IORedis from "ioredis";
import { env } from "../lib/env.js";

export const redisConnection = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
});
