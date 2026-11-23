import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx"],
  allowedDevOrigins: ['local', '*.local']
};

export default nextConfig;
