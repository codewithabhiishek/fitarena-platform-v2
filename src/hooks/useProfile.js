// src/hooks/useProfile.js
// ─────────────────────────────────────────────────────────────────────────────
// Fetches the current user's row from public.users and their leaderboard rank.
// Falls back to auth metadata if the DB row isn't ready yet.
//
// BUG FIX: Added real-time subscription to users table so profile points/streak
// update instantly after an admin approves a submission — no manual refresh needed.
//
// Returns:
//   profile   — enriched user object (or null)
//   loading   — true while fetching
//   error     — error message string (null otherwise)
//   refetch   — call this after a profile update to re-sync
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { getUserProfile, getUserRank } from "../services/userService";
import { supabase } from "../supabase/client";
import { isStreakAtRisk, isStreakBroken } from "../services/streakService";

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch profile and leaderboard position in parallel
      const [data, position] = await Promise.all([
        getUserProfile(user.id),
        getUserRank(user.id),
      ]);

      setProfile(buildProfile(data, user, position));
    } catch (err) {
      console.error("[useProfile] fetchProfile error:", err.message);
      setError(err.message);
      // Graceful fallback from auth metadata
      setProfile(buildFallbackProfile(user));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) fetchProfile();
  }, [authLoading, fetchProfile]);

  // BUG FIX: Subscribe to real-time updates on the users table so that when
  // increment_user_points RPC fires (after admin approves a submission),
  // the profile points and streak refresh automatically without a page reload.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "users",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[useProfile] Real-time user update received:", payload.new);
          // Compute streakAlert from the freshly-received last_active value
          const lastActive = payload.new.last_active ?? null;
          const streakAlert = isStreakBroken(lastActive)
            ? "💔 Your streak was broken. Start fresh today!"
            : isStreakAtRisk(lastActive)
            ? "⚠️ Complete a challenge today to keep your streak!"
            : null;
          // Merge the updated fields directly into the existing profile
          // to avoid a full round-trip on every keystroke elsewhere
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  points:         payload.new.points         ?? prev.points,
                  xp:             payload.new.xp             ?? prev.xp,
                  streak:         payload.new.streak         ?? prev.streak,
                  longest_streak: payload.new.longest_streak ?? prev.longest_streak,
                  last_active:    payload.new.last_active    ?? prev.last_active,
                  level:          payload.new.level          ?? prev.level,
                  rank:           rankFromLevel(payload.new.level ?? prev.level),
                  streakAlert,
                }
              : prev
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[useProfile] Real-time subscription active for user", user.id);
        }
      });

    return () => supabase.removeChannel(channel);
  }, [user]);

  return { profile, loading: authLoading || loading, error, refetch: fetchProfile };
}

// ── Build an enriched profile from DB data ───────────────────────────────────
function buildProfile(data, user, position) {
  const lastActive = data.last_active ?? null;
  const streakAlert = isStreakBroken(lastActive)
    ? "💔 Your streak was broken. Start fresh today!"
    : isStreakAtRisk(lastActive)
    ? "⚠️ Complete a challenge today to keep your streak!"
    : null;
  return {
    ...data,
    initials: deriveInitials(data.name || user.user_metadata?.full_name),
    joinDate: new Date(data.created_at).toLocaleDateString("en-US", {
      month: "short",
      year:  "numeric",
    }),
    rank:           rankFromLevel(data.level),
    longest_streak: data.longest_streak ?? 0,
    last_active:    lastActive,
    // is_admin comes straight from the DB row — never trust client-side state alone
    isAdmin: data.is_admin === true,
    leaderboardPosition: position,
    streakAlert,
  };
}

// ── Minimal fallback profile from auth token ─────────────────────────────────
function buildFallbackProfile(user) {
  const meta = user.user_metadata ?? {};
  const name = meta.full_name ?? user.email ?? "Athlete";
  return {
    id:      user.id,
    name,
    gym:     meta.gym ?? "",
    points:  0,
    xp:      0,
    level:   1,
    streak:  0,
    longest_streak: 0,
    last_active:    null,
    badges:  [],
    rank:    "Rookie",
    initials: deriveInitials(name),
    joinDate: new Date().toLocaleDateString("en-US", {
      month: "short",
      year:  "numeric",
    }),
    achievements:        [],
    leaderboardPosition: null,
  };
}

// Bug 6 Fix: Trim before the truthy check so whitespace-only names ("   ")
// don't slip past the "??" fallback. filter(Boolean) drops empty strings
// produced by split(" ") on multi-space input, preventing "UN" output.
function deriveInitials(name) {
  return (name?.trim() || "??")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function rankFromLevel(level) {
  if (level >= 20) return "Legend";
  if (level >= 15) return "Elite";
  if (level >= 10) return "Champion";
  if (level >= 5)  return "Contender";
  return "Rookie";
}
