import type { NextConfig } from "next";

const apiTarget = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
      { source: "/sanctum/:path*", destination: `${apiTarget}/sanctum/:path*` },

      /*
       * Signed media (recordings, PDFs, payment evidence, receipts) must be
       * same-origin, for two reasons:
       *   1. the Sanctum session cookie is scoped to this origin, so a link
       *      pointing straight at the API host arrives unauthenticated;
       *   2. trustedDestination() in the browser rejects anything that is
       *      neither same-origin nor an allow-listed HTTPS host.
       *
       * Laravel signs and validates against the forwarded host, so the
       * signature stays valid through this rewrite. See TrustProxies.
       */
      { source: "/media/:path*", destination: `${apiTarget}/media/:path*` },
    ];
  },
};

export default nextConfig;
