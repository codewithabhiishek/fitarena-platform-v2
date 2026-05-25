// src/hooks/useAuth.js
// ─────────────────────────────────────────────────────────────────────────────
// Core auth hook. Wraps Supabase's onAuthStateChange so every component that
// calls useAuth() gets a live, consistent view of the current session.
//
// Returns:
//   session   — the Supabase Session object (or null if signed out)
//   user      — the Supabase User object (shortcut for session?.user)
//   loading   — true while the initial session check is in flight
//   error     — any auth error string (null otherwise)
//   signOut   — async function to sign the user out
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "../supabase/client";
import { signOut as _signOut } from "../services/authService";

export function useAuth() {
  // undefined = still loading; null = definitely not signed in; Session = signed in
  const [session, setSession] = useState(undefined);
  const [error, setError]     = useState(null);

  useEffect(() => {
    // 1. Attempt to restore the persisted session from localStorage synchronously.
    //    This prevents the login screen from flashing on page refresh.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("[useAuth] getSession error:", error.message);
        setError(error.message);
      }
      setSession(session ?? null);
    });

    // 2. Subscribe to all future auth events:
    //    SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Clear errors on any successful auth event
      if (session) setError(null);
      setSession(session ?? null);

      // Handle Google OAuth redirect — after the redirect lands, Supabase
      // fires SIGNED_IN with the fresh session. No extra work needed here
      // because detectSessionInUrl:true in client.js handles the token exchange.
      if (event === "TOKEN_REFRESHED") {
        // Session was silently refreshed; state is already updated above.
      }

      if (event === "SIGNED_OUT") {
        setError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    try {
      await _signOut();
      // onAuthStateChange will set session → null automatically
    } catch (err) {
      setError(err.message);
    }
  }

  return {
    session,
    user: session?.user ?? null,
    // undefined = still checking, null/Session = resolved
    loading: session === undefined,
    error,
    signOut,
  };
}
