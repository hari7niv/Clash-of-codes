import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useResultData(matchId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [playerRes, matchRes, resultRes] = await Promise.all([
          api.get("/users/me"),
          api.get(`/matches/${matchId}`).catch(() => ({ data: null })),
          api.get(`/matches/${matchId}/result`).catch(() => ({ data: null }))
        ]);

        setData({
          player: playerRes.data,
          match: matchRes.data,
          result: resultRes.data,
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
