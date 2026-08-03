const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Drastically speed up Vercel builds by skipping linting and type checking
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
