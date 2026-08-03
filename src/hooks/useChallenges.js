import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  getChallenges,
  getChallengeStats,
  getMyBestScores,
  getMyPendingChallengeIds,
  subscribeToChallenges,
} from "../services/challengeService";
import { subscribeToSubmissions } from "../services/submissionService";

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
          myScore:      myScores[ch.id] ?? 0,
          myPending:    myPendingIds.has(ch.id),
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
    let unsubSub = () => {};

    if (realtime) {
      unsubCh = subscribeToChallenges(() => fetchChallenges());
      unsubSub = subscribeToSubmissions(() => fetchChallenges());
    }

    return () => {
      unsubCh();
      unsubSub();
    };
  }, [fetchChallenges, realtime]);

  return { challenges, loading, error, refetch: fetchChallenges };
}

function formatDeadline(date) {
  const now  = new Date();
  const diff = Math.round((date - now) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return "Ended";
  if (diff === 0) return "Ends today";
  if (diff === 1) return "1 day left";
  return `${diff} days left`;
}
