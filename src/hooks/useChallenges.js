// src/hooks/useChallenges.js
// ─────────────────────────────────────────────────────────────────────────────
// Fetches active challenges and subscribes to real-time updates.
// Enriches each challenge with real top-score, participant count, and the
// current user's best approved score.
//
// Returns:
//   challenges — array of enriched challenge rows
//   loading    — true on initial fetch
//   error      — error string or null
//   refetch    — manual refetch trigger
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  getChallenges,
  getChallengeStats,
  getMyBestScores,
  getMyPendingChallengeIds,
  subscribeToChallenges,
} from "../services/challengeService";
import { supabase } from "../supabase/client";

// Icon + color map used when seeding from the DB
export const CHALLENGE_META = {
  Pushup:     { icon: "💪", color: "#39FF14" },
  Deadlift:   { icon: "🏋️", color: "#00BFFF" },
  Squat:      { icon: "🦵", color: "#FF6B35" },
  Plank:      { icon: "⚡", color: "#C77DFF" },
  Attendance: { icon: "🎯", color: "#FFD700" },
};

export function useChallenges(realtime = false) {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Run all three queries in parallel
      const [raw, statsMap, myScores, myPendingIds] = await Promise.all([
        getChallenges(),
        getChallengeStats(),
        getMyBestScores(user?.id ?? null),
        getMyPendingChallengeIds(user?.id ?? null),
      ]);

      const enriched = raw.map((ch) => {
        const stats = statsMap[ch.id] ?? { topScore: 0, participants: 0 };
        return {
          ...ch,
          icon:  ch.icon  || CHALLENGE_META[ch.type]?.icon  || "🏅",
          color: ch.color || CHALLENGE_META[ch.type]?.color || "#39FF14",
          deadline: ch.deadline ? formatDeadline(new Date(ch.deadline)) : "Ongoing",
          // Real stats from submissions
          myScore:      myScores[ch.id] ?? 0,
          myPending:    myPendingIds.has(ch.id),   // submitted, awaiting approval
          topScore:     stats.topScore,
          participants: stats.participants,
        };
      });

      setChallenges(enriched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchChallenges();

    let unsubCh = () => {};
    let subChannel = null;

    if (realtime) {
      // Re-fetch when challenges or submissions change
      unsubCh = subscribeToChallenges(() => fetchChallenges());

      subChannel = supabase
        .channel("submissions-for-challenges")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "submissions" },
          () => fetchChallenges()
        )
        .subscribe();
    }

    return () => {
      unsubCh();
      if (subChannel) {
        supabase.removeChannel(subChannel);
      }
    };
  }, [fetchChallenges, realtime]);

  return { challenges, loading, error, refetch: fetchChallenges };
}

// ── Format a deadline Date into a human string ────────────────────────────────
function formatDeadline(date) {
  const now  = new Date();
  const diff = Math.round((date - now) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return "Ended";
  if (diff === 0) return "Ends today";
  if (diff === 1) return "1 day left";
  return `${diff} days left`;
}
