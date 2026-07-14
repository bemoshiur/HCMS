import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Docker image; Vercel manages its own output
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
