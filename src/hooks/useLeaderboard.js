// src/hooks/useLeaderboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Fetches the leaderboard from Supabase and subscribes to real-time updates
// so ranks update automatically when users earn points.
//
// BUG FIX: Separated real-time subscription into its own effect with [] deps
// so the channel is created exactly once and not torn down on every tab switch.
//
// BUG FIX: Accepts a `period` parameter ('daily'|'weekly'|'monthly'|'all-time')
// and passes it to getLeaderboard() for real time-based filtering.
//
// Returns:
//   board    — array of ranked user rows
//   loading  — true on initial fetch
//   error    — error string or null
//   refetch  — manual refetch trigger
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { getLeaderboard } from "../services/userService";
import { supabase } from "../supabase/client";

export function useLeaderboard(limit = 20, period = "all-time", realtime = false) {
  const [board, setBoard]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getLeaderboard(limit, period);
      const enriched = rows.map((u) => ({
        ...u,
        leaderboardPosition: Number(u.position),
        initials: (u.name?.trim() || "??")
          .split(" ")
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        change: "same",
      }));
      setBoard(enriched);
      console.log(`[useLeaderboard] Fetched ${enriched.length} rows (period: ${period})`);
    } catch (err) {
      console.error("[useLeaderboard] fetchBoard error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit, period]);

  // Always keep a current reference to fetchBoard so the real-time
  // subscription callback (which runs inside a [] effect) never calls a
  // stale version after the period tab changes.
  const fetchBoardRef = useRef(fetchBoard);
  useEffect(() => { fetchBoardRef.current = fetchBoard; }, [fetchBoard]);

  // Re-fetch when period/limit changes
  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Real-time subscription — runs dynamically based on the realtime flag.
  // Uses fetchBoardRef so it always calls the latest fetchBoard without
  // tearing down and re-creating the channel on every tab switch.
  useEffect(() => {
    if (!realtime) return;

    const usersChannel = supabase
      .channel("leaderboard-users-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        () => {
          console.log("[useLeaderboard] users UPDATE detected — refreshing board");
          fetchBoardRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
    };
  }, [realtime]);

  return { board, loading, error, refetch: fetchBoard };
}
