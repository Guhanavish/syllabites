import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Slimmer client bundles via per-module imports (build-time only). */
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@supabase/postgrest-js",
      "@supabase/realtime-js",
    ],
  },
};

export default nextConfig;
