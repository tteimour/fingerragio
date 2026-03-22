import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use static export for Cloudflare Pages deployment
  output: process.env.CLOUDFLARE_BUILD === "1" ? "export" : undefined,
};

export default nextConfig;
