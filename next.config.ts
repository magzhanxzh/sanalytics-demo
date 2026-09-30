import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // do not generate AGENTS.md / CLAUDE.md on next dev
  agentRules: false,
  // no floating dev overlay button (gets in the way of screenshots)
  devIndicators: false,
};

export default nextConfig;
