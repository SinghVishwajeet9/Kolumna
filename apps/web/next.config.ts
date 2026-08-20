import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false, // stop `next dev` from regenerating AGENTS.md/CLAUDE.md
};

export default nextConfig;
