// src/services/authService.js
// ─────────────────────────────────────────────────────────────────────────────
// All authentication calls go through here — never call supabase.auth directly
// from components. This keeps auth logic testable and centralised.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../supabase/client";

// ── Sign up with email + password ────────────────────────────────────────────
// Also stores name + gym in user_metadata so the DB trigger can pick them up.
export async function signUpWithEmail({ email, password, name, gym }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, gym },
    },
  });
  if (error) throw error;
  return data;
}

// ── Sign in with email + password ────────────────────────────────────────────
export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ── Google OAuth ─────────────────────────────────────────────────────────────
// Redirects to Google; Supabase handles the callback and sets the session.
// Add http://localhost:3000 (dev) and your prod URL to:
//   Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        // Request offline access so Google returns a refresh token
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error) throw error;
  return data;
}

// ── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Get the currently authenticated user (one-shot) ──────────────────────────
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  return user; // null if not signed in
}

// ── Subscribe to auth state changes (sign-in, sign-out, token refresh) ───────
// Returns an unsubscribe function — call it in useEffect cleanup.
//
// Usage:
//   const unsub = onAuthStateChange((session) => { ... });
//   return () => unsub();
export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}
