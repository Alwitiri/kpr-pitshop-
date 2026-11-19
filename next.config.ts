import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal business app: every page shows live shop data, so we use
  // request-time rendering instead of Cache Components.
  cacheComponents: false,
  // Self-contained server folder that is packaged with its own Node.js for shop PCs
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: {
      // Default is 1 MB. Shops upload logos, product photos, supplier bill photos and
      // whole backup files (.db) through forms, so allow much larger requests.
      bodySizeLimit: "100mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
