import type { NextConfig } from "next";

// Where the real API lives (e.g. https://kolumna-api.onrender.com).
// Set on the host; unset in local dev, where the browser calls the API directly.
// A trailing slash would turn /api/auth/me into //auth/me, so strip it.
const API_ORIGIN = process.env.API_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false, // stop `next dev` from regenerating AGENTS.md/CLAUDE.md

  // Hosted setup: the browser calls /api/... on the web app's own address and
  // Next forwards it to the API. Because the browser only ever talks to ONE
  // site, the login cookie is first-party and works without owning a domain.
  // Set NEXT_PUBLIC_API_URL=/api on the host to switch the client over.
  async rewrites() {
    if (!API_ORIGIN) return [];
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
