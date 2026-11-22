import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The budget is home. Runs before the proxy, which then sends signed-out visitors to /login.
  async redirects() {
    return [{ source: "/", destination: "/budget", permanent: false }];
  },
  partialPrefetching: true,
  // The import wizard sends up to 5,000 rows (about 1 MB as JSON) to a server action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
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
