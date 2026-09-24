import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // не генерировать AGENTS.md / CLAUDE.md при next dev
  agentRules: false,
  // без плавающей кнопки dev-оверлея (мешает скриншотам)
  devIndicators: false,
};

export default nextConfig;
