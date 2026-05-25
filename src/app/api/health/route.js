// src/app/api/health/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Health check endpoint — used by UptimeRobot (or any uptime monitor) to
// verify the app and its Supabase connection are both alive.
//
// Returns 200 { status: "ok" } when everything is healthy.
// Returns 503 { status: "error" } when the DB is unreachable.
//
// UptimeRobot setup:
//   Monitor type : HTTP(s)
//   URL          : https://your-vercel-domain.vercel.app/api/health
//   Interval     : 5 minutes
//   Alert on     : Non-2xx response OR keyword "error" in body
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const start = Date.now();

  try {
    // Create a lightweight Supabase client (no auth needed for a ping)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Head-only query — fetches zero bytes of data, just confirms DB is reachable
    const { error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({
      status: "ok",
      db: "connected",
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
