// src/supabase/client.js
// ─────────────────────────────────────────────────────────────────────────────
// Supabase client — single shared instance for the entire app.
//
// ENV VARS (add to .env.local for Next.js):
//   NEXT_PUBLIC_SUPABASE_URL=...
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//
// Import this wherever you need DB / Auth / Storage:
//   import { supabase } from '@/supabase/client'
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

// Bug 3 Fix: Use console.error instead of a module-level throw.
// A top-level throw crashes the entire JS bundle at evaluation time —
// React error boundaries cannot catch it, leaving a blank white screen.
// Using empty strings lets the app render a meaningful error state instead.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[FitArena] Missing Supabase env vars. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist sessions in localStorage so users stay logged in on refresh
    persistSession: true,
    // Automatically refresh the JWT before it expires
    autoRefreshToken: true,
    // Detect OAuth redirects (Google Sign-In callback)
    detectSessionInUrl: true,
  },
});
