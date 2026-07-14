import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default Next.js output — works for both AWS Amplify SSR compute and the
  // self-hosted Docker image (`next start`).
  // @react-pdf/renderer + its font/blob deps run in Node server routes.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Lint runs separately (pnpm lint / CI); deploy builds shouldn't fail on style.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
