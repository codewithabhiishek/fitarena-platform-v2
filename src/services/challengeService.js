// src/services/challengeService.js
// ─────────────────────────────────────────────────────────────────────────────
// All challenge-related DB calls. Includes real-time subscription helpers.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../supabase/client";

// ── Fetch all active challenges ───────────────────────────────────────────────
export async function getChallenges() {
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ── Fetch a single challenge by ID ───────────────────────────────────────────
export async function getChallengeById(id) {
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ── Fetch stats for all active challenges (top score, participant count) ──────
// Returns a map of { [challengeId]: { topScore, participants } }
// Uses the get_challenge_stats() Postgres RPC to aggregate server-side,
// avoiding a full-table fetch that would download unbounded data on every load.
export async function getChallengeStats() {
  const { data, error } = await supabase.rpc("get_challenge_stats");
  if (error) {
    console.warn("[ChallengeStats] RPC error:", error.message);
    return {};
  }
  const result = {};
  for (const row of data ?? []) {
    result[row.challenge_id] = {
      topScore: row.top_score ?? 0,
      participants: Number(row.participant_count) ?? 0,
    };
  }
  return result;
}

// ── Fetch the current user's best approved score per challenge ────────────────
// Returns a map of { [challengeId]: bestScore }
export async function getMyBestScores(userId) {
  if (!userId) return {};

  const { data, error } = await supabase
    .from("submissions")
    .select("challenge_id, score")
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) {
    console.warn("[MyScores] Could not load scores:", error.message);
    return {};
  }

  const best = {};
  for (const row of data) {
    const cid = row.challenge_id;
    if (!best[cid] || row.score > best[cid]) {
      best[cid] = row.score;
    }
  }
  return best;
}

// ── Create a new challenge (admin only) ──────────────────────────────────────
export async function createChallenge(userId, challenge) {
  const { data, error } = await supabase
    .from("challenges")
    .insert({ ...challenge, created_by: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Update a challenge (admin only) ──────────────────────────────────────────
export async function updateChallenge(id, updates) {
  const { data, error } = await supabase
    .from("challenges")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Deactivate (soft-delete) a challenge ─────────────────────────────────────
export async function deactivateChallenge(id) {
  return updateChallenge(id, { active: false });
}

// ── Real-time: subscribe to changes on the challenges table ──────────────────
// Returns an unsubscribe function.
export function subscribeToChallenges(callback) {
  const channel = supabase
    .channel("challenges-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "challenges" },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ── Fetch the current user's pending (submitted, awaiting approval) challenge IDs ──
// Returns a Set of challenge IDs where the user has a pending submission.
export async function getMyPendingChallengeIds(userId) {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from("submissions")
    .select("challenge_id")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    console.warn("[MyPending] Could not load pending submissions:", error.message);
    return new Set();
  }

  return new Set(data.map(r => r.challenge_id));
}
