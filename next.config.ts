import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Never ship production source maps to browsers. */
  productionBrowserSourceMaps: false,
  /* Drop the X-Powered-By header: fewer bytes on every response. */
  poweredByHeader: false,
  /* Slimmer client bundles via per-module imports (build-time only). */
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@supabase/postgrest-js",
      "@supabase/realtime-js",
    ],
  },
  async headers() {
    const supabaseOrigin = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
      } catch {
        return "";
      }
    })();
    const connectSrc = ["'self'", supabaseOrigin, "https://*.supabase.co"].filter(Boolean).join(" ");
    const csp = [
      "default-src 'self'",
      `connect-src ${connectSrc}`,
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      // NOTE: script 'unsafe-inline' is required for Next.js hydration
      // payloads and the JSON-LD blocks. Interactive XSS defense still
      // comes from React output-encoding plus the validators in src/lib/server.ts.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
