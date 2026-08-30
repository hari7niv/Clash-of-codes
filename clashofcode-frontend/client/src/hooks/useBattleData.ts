import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useBattleData(matchId: string) {
  const [data, setData] = useState({
    player: null as any,
    matchData: null as any,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [playerRes, matchRes] = await Promise.all([
          api.get("/users/me"),
          api.get(`/matches/${matchId}`),
        ]);

        setData({
          player: playerRes.data,
          matchData: matchRes.data,
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [matchId]);

  return { ...data, loading, error };
}
