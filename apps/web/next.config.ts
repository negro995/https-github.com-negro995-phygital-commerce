import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@phygital/shared"],
  reactStrictMode: true,
};

export default nextConfig;
