// instrumentation.js
// ─────────────────────────────────────────────────────────────────────────────
// Required by Next.js 15 + Sentry to initialize Sentry on the server side.
// Without this file, sentry.server.config.js and sentry.edge.config.js are
// never loaded — server errors and API route errors won't reach Sentry at all.
//
// Next.js loads this file automatically when `experimental.instrumentationHook`
// is enabled (Next.js 15 enables it by default).
// ─────────────────────────────────────────────────────────────────────────────

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
