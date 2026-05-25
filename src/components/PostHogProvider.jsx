"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export default function PostHogProvider({ children }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
    if (!key) return; // analytics is optional — skip silently if not configured
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      // Don't capture sensitive form content
      autocapture: {
        dom_event_allowlist: ["click"],
        element_allowlist: ["button", "a"],
      },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
