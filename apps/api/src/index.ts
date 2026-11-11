import { app } from "./app.js";
import { env } from "./lib/env.js";

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});

// Last resort: log a stray rejection instead of dying. Route handlers are
// wrapped (asyncHandler) so this should never fire; if it does, one failed
// request shouldn't take every user's session down with it.
process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandled rejection:", reason);
});
