import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Docker image; Vercel manages its own output
  output: process.env.VERCEL ? undefined : "standalone",
  eslint: {
    // Lint runs in dev/CI; deploy builds shouldn't fail on style rules
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
