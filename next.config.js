const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
function getSupabaseHostname() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return "";
    return new URL(url).hostname;
  } catch {
    console.warn("[next.config.js] NEXT_PUBLIC_SUPABASE_URL is set but not a valid URL — skipping image domain config.");
    return "";
  }
}
const supabaseHostname = getSupabaseHostname();

const nextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname }] : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppresses Sentry CLI output during builds — keeps logs clean
  silent: true,
  // Uploads larger portion of client-side source maps for better stack traces
  widenClientFileUpload: true,
  // Hides Sentry's own source maps from the browser bundle
  hideSourceMaps: true,
  // Tree-shakes Sentry's debug logger in production builds
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
