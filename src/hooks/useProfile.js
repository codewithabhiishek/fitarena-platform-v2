import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { getUserProfile, getUserRank } from "../services/userService";
import { db } from "../firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
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
      const [data, position] = await Promise.all([
        getUserProfile(user.id),
        getUserRank(user.id),
      ]);

      setProfile(buildProfile(data, user, position));
    } catch (err) {
      console.error("[useProfile] fetchProfile error:", err.message);
      setError(err.message);
      setProfile(buildFallbackProfile(user));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) fetchProfile();
  }, [authLoading, fetchProfile]);

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, "users", user.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const lastActive = data.last_active ?? null;
        const streakAlert = isStreakBroken(lastActive)
          ? "💔 Your streak was broken. Start fresh today!"
          : isStreakAtRisk(lastActive)
          ? "⚠️ Complete a challenge today to keep your streak!"
          : null;

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                points:         data.points         ?? prev.points,
                xp:             data.xp             ?? prev.xp,
                streak:         data.streak         ?? prev.streak,
                longest_streak: data.longest_streak ?? prev.longest_streak,
                last_active:    data.last_active    ?? prev.last_active,
                level:          data.level          ?? prev.level,
                rank:           rankFromLevel(data.level ?? prev.level),
                streakAlert,
              }
            : prev
        );
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { profile, loading: authLoading || loading, error, refetch: fetchProfile };
}

function buildProfile(data, user, position) {
  const lastActive = data.last_active ?? null;
  const streakAlert = isStreakBroken(lastActive)
    ? "💔 Your streak was broken. Start fresh today!"
    : isStreakAtRisk(lastActive)
    ? "⚠️ Complete a challenge today to keep your streak!"
    : null;
    
  const clerkName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email?.split('@')[0];
  
  return {
    ...data,
    initials: deriveInitials(data.name || clerkName),
    joinDate: new Date(data.created_at).toLocaleDateString("en-US", {
      month: "short",
      year:  "numeric",
    }),
    rank:           rankFromLevel(data.level),
    longest_streak: data.longest_streak ?? 0,
    last_active:    lastActive,
    isAdmin: data.is_admin === true,
    leaderboardPosition: position,
    streakAlert,
  };
}

function buildFallbackProfile(user) {
  const name = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email?.split('@')[0] || "Athlete";
  return {
    id:      user.id,
    name,
    gym:     "",
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
