import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration tests hit the real Neon database (see tests/isolation.test.ts).
    // Run them serially — parallel runs would race on the same rows.
    fileParallelism: false,
  },
});
