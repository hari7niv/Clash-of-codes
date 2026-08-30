import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useDashboardData() {
  const [data, setData] = useState({
    player: null as any,
    quests: [] as any[],
    recentBattles: [] as any[],
    mastery: [] as any[],
    recommendations: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [
          playerRes,
          questsRes,
          battlesRes,
          masteryRes,
          recommendationsRes,
        ] = await Promise.all([
          api.get("/users/me"),
          api.get("/quests/today"),
          api.get("/users/me/battles"),
          api.get("/users/me/mastery"),
          api.get("/practice/recommendations"),
        ]);

        setData({
          player: playerRes.data,
          quests: questsRes.data,
          recentBattles: battlesRes.data,
          mastery: masteryRes.data,
          recommendations: recommendationsRes.data,
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { ...data, loading, error };
}
