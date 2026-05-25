// src/services/userService.js
// ─────────────────────────────────────────────────────────────────────────────
// Profile read / update / avatar upload / leaderboard.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../supabase/client";

// ── Fetch a user's profile by their auth UID ─────────────────────────────────
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[getUserProfile] Error fetching profile:", error.message);
    throw error;
  }
  return data;
}

// ── Update name / gym / avatar_url via SECURITY DEFINER RPC ─────────────────
// SECURITY: We call the update_user_profile RPC instead of .update() directly.
// The RPC is SECURITY DEFINER and only touches name/gym/avatar_url — it is
// impossible for a caller to sneak updates to points, xp, level, or streak
// through this path, even if they call Supabase directly from the browser.
export async function updateUserProfile(_userId, updates) {
  const { error } = await supabase.rpc("update_user_profile", {
    p_name:       updates.name       ?? null,
    p_gym:        updates.gym        ?? null,
    p_avatar_url: updates.avatar_url ?? null,
  });

  if (error) {
    console.error("[updateUserProfile] RPC error:", error.message);
    throw error;
  }
}

// ── Upload avatar to Supabase Storage and save the URL on the profile ────────
export async function uploadAvatar(userId, file) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  const bustUrl = `${data.publicUrl}?t=${Date.now()}`;
  await updateUserProfile(userId, { avatar_url: bustUrl });
  return bustUrl;
}

// ── Fetch the ranked leaderboard ─────────────────────────────────────────────
// Queries the `leaderboard` view which pre-computes rank positions.
// Falls back to querying `users` directly if the view is unavailable.
// Accepts a `period` param ('daily'|'weekly'|'monthly'|'all-time') and
// filters by `last_active` date accordingly.
export async function getLeaderboard(limit = 20, period = "all-time") {
  // last_active is a DATE column, so compare it with an unambiguous UTC date.
  let since = null;
  if (period === "daily" || period === "active today") {
    since = new Date().toISOString().slice(0, 10);
  } else if (period === "weekly" || period === "active this week") {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7);
    since = d.toISOString().slice(0, 10);
  } else if (period === "monthly" || period === "active this month") {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    since = d.toISOString().slice(0, 10);
  }

  let query = supabase
    .from("leaderboard")
    .select("id, name, gym, points, streak, rank, avatar_url, position, last_active")
    .order("position", { ascending: true })
    .limit(limit);

  if (since) {
    query = query.gte("last_active", since);
  }

  const { data, error } = await query;

  if (!error && data) return data;

  console.warn("[getLeaderboard] leaderboard view unavailable, falling back to users table:", error?.message);

  // Fallback: query users table directly with manual rank
  let fallbackQuery = supabase
    .from("users")
    .select("id, name, gym, points, streak, rank, avatar_url, last_active")
    .order("points", { ascending: false })
    .limit(limit);

  if (since) {
    fallbackQuery = fallbackQuery.gte("last_active", since);
  }

  const { data: users, error: usersError } = await fallbackQuery;

  if (usersError) {
    console.error("[getLeaderboard] Fallback query failed:", usersError.message);
    throw usersError;
  }

  return users.map((u, i) => ({ ...u, position: i + 1 }));
}

// ── Fetch a single user's leaderboard position ────────────────────────────────
export async function getUserRank(userId) {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("position")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("[getUserRank] Could not fetch rank:", error.message);
    return null;
  }
  return data?.position ?? null;
}

// addPointsToUser was removed — DO NOT re-add it.
//
// A read-then-write approach (fetch points, add locally, write back)
// is NOT safe for concurrent updates. Two simultaneous calls would
// both read the same value and one would silently overwrite the other,
// losing points with no error or warning.
//
// Points are awarded atomically by the on_submission_approved DB trigger
// (SECURITY DEFINER, runs as postgres, bypasses RLS).
// The trigger is the ONLY correct place to award points.
// Never award points from the frontend or from a service function.
