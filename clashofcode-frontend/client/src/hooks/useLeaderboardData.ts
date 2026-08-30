import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useLeaderboardData(tab: string) {
  const [data, setData] = useState({
    player: null as any,
    leaderboard: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [playerRes, leaderboardRes] = await Promise.all([
          api.get("/users/me"),
          api.get(`/leaderboard?tab=${tab.toLowerCase()}`),
        ]);

        setData({
          player: playerRes.data,
          leaderboard: leaderboardRes.data,
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tab]);

  return { ...data, loading, error };
}
