import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  // Only run Sentry in production — keeps dev console clean
  enabled: process.env.NODE_ENV === "production",
});
