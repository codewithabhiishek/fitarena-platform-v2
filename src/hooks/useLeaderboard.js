import { useState, useEffect, useCallback, useRef } from "react";
import { getLeaderboard } from "../services/userService";
import { db } from "../firebase/client";
import { collection, onSnapshot } from "firebase/firestore";

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
    } catch (err) {
      console.error("[useLeaderboard] fetchBoard error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit, period]);

  const fetchBoardRef = useRef(fetchBoard);
  useEffect(() => { fetchBoardRef.current = fetchBoard; }, [fetchBoard]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    if (!realtime) return;

    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, () => {
      fetchBoardRef.current();
    });

    return () => unsubscribe();
  }, [realtime]);

  return { board, loading, error, refetch: fetchBoard };
}
