"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// This file is Next.js's global error boundary — it catches unhandled errors
// in the root layout and any server component errors that bubble up.
// Sentry.captureException sends them to your Sentry dashboard automatically.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{
        background: "#0a0a0a",
        color: "#f0f0f0",
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 16,
        margin: 0,
      }}>
        <div style={{ fontSize: 48 }}>⚡</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#39FF14" }}>FitArena</div>
        <div style={{ fontSize: 14, color: "#555" }}>Something went wrong.</div>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            background: "#39FF14",
            color: "#000",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: 14,
          }}>
          Try Again
        </button>
      </body>
    </html>
  );
}
