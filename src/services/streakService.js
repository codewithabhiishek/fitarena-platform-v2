// src/services/streakService.js
// Read-only streak utility functions.
// This file NEVER writes to the database — all mutations happen server-side
// via Supabase triggers / RPC functions.

import { supabase } from "../supabase/client";

// ─── RPC ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the full streak status for a user from the DB.
 * @param {string} userId
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function getStreakStatus(userId) {
  return supabase.rpc("get_user_streak_status", { p_user_id: userId });
}

// ─── HUMAN-READABLE MESSAGE ───────────────────────────────────────────────────

/**
 * Returns a motivational / status string based on streak_status + current streak.
 * @param {string} status  - DB values: "active_today" | "at_risk" | "broken" | "never"
 * @param {number} streak  - current streak count
 * @returns {string}
 */
export function getStreakMessage(status, streak) {
  switch (status) {
    case "active_today":
      if (streak >= 30) return `🏆 ${streak}-day legend! Keep dominating!`;
      if (streak >= 14) return `🔥 ${streak} days strong — you're on fire!`;
      if (streak >= 7)  return `💪 ${streak}-day streak — great consistency!`;
      if (streak >= 3)  return `✅ ${streak} days in a row — keep it up!`;
      return "✅ Streak credited for today!";

    case "at_risk":
      return "⚠️ Complete a challenge today to keep your streak alive!";

    case "broken":
      return "💔 Your streak was broken. Start fresh today!";

    case "never":
    default:
      return "🚀 Complete your first challenge to start a streak!";
  }
}

// ─── DATE HELPERS (UTC) ───────────────────────────────────────────────────────

/**
 * Returns the UTC date string (YYYY-MM-DD) for a given Date (defaults to now).
 * @param {Date} [date]
 * @returns {string}
 */
function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns true if lastActive (ISO string or Date) equals today's UTC date.
 * @param {string|Date|null} lastActive
 * @returns {boolean}
 */
export function isStreakCreditedToday(lastActive) {
  if (!lastActive) return false;
  return utcDateString(new Date(lastActive)) === utcDateString();
}

/**
 * Returns true if lastActive was yesterday in UTC (streak is at risk).
 * @param {string|Date|null} lastActive
 * @returns {boolean}
 */
export function isStreakAtRisk(lastActive) {
  if (!lastActive) return false;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return utcDateString(new Date(lastActive)) === utcDateString(yesterday);
}

/**
 * Returns true if lastActive is older than yesterday UTC (streak is broken).
 * @param {string|Date|null} lastActive
 * @returns {boolean}
 */
export function isStreakBroken(lastActive) {
  if (!lastActive) return false;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const lastActiveDay = utcDateString(new Date(lastActive));
  return lastActiveDay < utcDateString(yesterday);
}

// ─── FORMATTING ───────────────────────────────────────────────────────────────

/**
 * Formats a streak count as "7 🔥", or "—" when 0 / null / undefined.
 * @param {number|null|undefined} streak
 * @returns {string}
 */
export function formatStreak(streak) {
  if (!streak || streak <= 0) return "—";
  return `${streak} 🔥`;
}
