import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded Postgres (local dev) ships WASM files, and exceljs is a large CJS
  // library; both run fine unbundled on the server.
  serverExternalPackages: ["@electric-sql/pglite", "exceljs"],
  experimental: {
    // Room for spreadsheet uploads on the admin page (default is 1 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must never be cached, or app updates would be delayed.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
