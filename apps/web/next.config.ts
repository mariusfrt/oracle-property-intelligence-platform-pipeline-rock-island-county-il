import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@oracle/shared"],
  env: {
    ACCESS_TOKEN: process.env.ACCESS_TOKEN,
  },
};

export default nextConfig;
