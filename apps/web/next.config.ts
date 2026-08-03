import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@oracle/shared"],
  env: {
    ACCESS_TOKEN: process.env.ACCESS_TOKEN,
  },
  // The agent lives on the Explorer page; send the old /agent path there.
  async redirects() {
    return [{ source: "/agent", destination: "/explorer", permanent: false }];
  },
};

export default nextConfig;
