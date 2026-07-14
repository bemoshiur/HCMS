import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` output is ONLY for the self-hosted Docker image (Dockerfile
  // sets DOCKER_BUILD=1). AWS Amplify Hosting and Vercel both use the default
  // Next.js build output for their managed SSR compute.
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
  // @react-pdf/renderer + its font/blob deps run in Node server routes.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Lint runs separately (pnpm lint / CI); deploy builds shouldn't fail on style.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
