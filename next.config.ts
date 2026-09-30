import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded Postgres (local dev) ships WASM files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
