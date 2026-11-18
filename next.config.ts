import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal business app: every page shows live shop data, so we use
  // request-time rendering instead of Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
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
