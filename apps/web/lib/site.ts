// The site's public address, used for absolute links in previews, the sitemap
// and canonical URLs. Set NEXT_PUBLIC_SITE_URL once there's a custom domain;
// until then Vercel's production address is used, and localhost in dev.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const SITE_NAME = "Kolumna";
export const SITE_TITLE = "Kolumna: let AI agents work on your board, safely";
export const SITE_DESCRIPTION =
  "Approvals, budgets and a full audit trail for Claude Code, Cursor and any MCP agent working on your team's board.";
