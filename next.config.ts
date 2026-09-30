import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded Postgres (local dev) ships WASM files, and exceljs is a large CJS
  // library; both run fine unbundled on the server.
  serverExternalPackages: ["@electric-sql/pglite", "exceljs"],
  experimental: {
    // Room for spreadsheet uploads on the admin page (default is 1 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
