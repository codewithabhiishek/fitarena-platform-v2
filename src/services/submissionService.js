// src/services/submissionService.js
// Score submission + admin approve/reject.

import { supabase } from "../supabase/client";

// Module-level idempotency guard.
// Tracks submission IDs currently being approved in this JS process.
// Prevents duplicate calls from double-clicks, realtime echo, or multi-tab.
const _approvingInFlight = new Set();

// Bug 5 Fix: Same in-flight guard for rejectSubmission — mirrors _approvingInFlight.
// Without this, two rapid reject clicks fire two concurrent network requests.
const _rejectingInFlight = new Set();

// Submit a score.
export async function submitScore({ userId, challengeId, score }) {
  // Server-side unlock validation: confirm the user actually scanned this challenge
  const { data: unlock, error: unlockErr } = await supabase
    .from("unlocked_challenges")
    .select("challenge_id")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId)
    .maybeSingle();

  if (unlockErr) throw unlockErr;
  if (!unlock) {
    throw new Error("UNLOCK_REQUIRED: You must scan the QR code before submitting.");
  }

  // existing insert logic below, unchanged
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      user_id:      userId,
      challenge_id: challengeId,
      score,
      status:       "pending",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You've already submitted for this challenge today.");
    }
    throw error;
  }

  return data;
}

// Get all submissions for a specific challenge (admin view).
export async function getSubmissionsForChallenge(challengeId) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, users(name, avatar_url)")
    .eq("challenge_id", challengeId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Get all of the current user's submissions.
export async function getMySubmissions(userId) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, challenges(title, type, icon, color, points)")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Get pending submissions (admin queue).
// Explicit column list ensures user_id is always present at the top level
// so the self-approval filter (s.user_id !== adminId) works correctly.
export async function getPendingSubmissions() {
  console.log("[getPendingSubmissions] Fetching pending submissions...");

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, user_id, challenge_id, score, status, submitted_at, " +
      "users(name, avatar_url), " +
      "challenges(title, type, points)"
    )
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  if (error) {
    console.error("[getPendingSubmissions] Query error:", error.message);
    throw error;
  }

  // Detect rows where the challenges join returned null (RLS dropped it)
  const missingChallenge = (data ?? []).filter(s => !s.challenges);

  if (missingChallenge.length > 0) {
    console.warn(
      "[getPendingSubmissions] challenges join dropped",
      missingChallenge.length,
      "row(s) — running fallback query for those IDs"
    );

    // Fallback: fetch challenge data separately for the affected rows
    const missingIds = [...new Set(missingChallenge.map(s => s.challenge_id))];
    const { data: fallbackChallenges, error: fbErr } = await supabase
      .from("challenges")
      .select("id, title, type, points")
      .in("id", missingIds);

    if (!fbErr && fallbackChallenges) {
      const challengeMap = Object.fromEntries(fallbackChallenges.map(c => [c.id, c]));
      for (const row of missingChallenge) {
        row.challenges = challengeMap[row.challenge_id] ?? null;
      }
    } else {
      console.error("[getPendingSubmissions] Fallback query also failed:", fbErr?.message);
    }
  }

  console.log("[getPendingSubmissions] Returning", data?.length ?? 0, "rows");
  return data ?? [];
}

// Approval and rejection use narrow DB functions. Clients cannot UPDATE a
// submission row directly or change its user, score, or challenge.
export async function approveSubmission(submissionId) {
  if (_approvingInFlight.has(submissionId)) {
    throw new Error("DUPLICATE: This submission is already being processed.");
  }
  _approvingInFlight.add(submissionId);

  try {
    const { data, error } = await supabase.rpc("approve_submission", {
      p_submission_id: submissionId,
    });
    if (error) throw new Error(error.message);
    return data;
  } finally {
    _approvingInFlight.delete(submissionId);
  }
}

export async function rejectSubmission(submissionId) {
  if (_rejectingInFlight.has(submissionId)) {
    throw new Error("DUPLICATE: This submission is already being processed.");
  }
  _rejectingInFlight.add(submissionId);

  try {
    const { data, error } = await supabase.rpc("reject_submission", {
      p_submission_id: submissionId,
    });
    if (error) throw new Error(error.message);
    return data;
  } finally {
    _rejectingInFlight.delete(submissionId);
  }
}

// Real-time: subscribe to submission INSERT and UPDATE events.
export function subscribeToSubmissions(callback) {
  const channel = supabase
    .channel("submissions-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "submissions" },
      callback
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "submissions" },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
