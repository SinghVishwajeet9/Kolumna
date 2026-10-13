import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration tests hit the real Neon database (see tests/isolation.test.ts).
    // Run them serially — parallel runs would race on the same rows.
    fileParallelism: false,
    // Every query is a round trip to a remote Neon DB (~250ms+); a test that
    // does a full hosted run twice legitimately exceeds the 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
