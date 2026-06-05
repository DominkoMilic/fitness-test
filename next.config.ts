import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Never let a CDN/browser HTTP-cache the service worker script itself,
        // or a new deploy's sw.js can be masked by a stale cached copy and the
        // update is never detected. The SW's own caches still serve assets
        // offline; this only governs fetching sw.js to check for updates.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
