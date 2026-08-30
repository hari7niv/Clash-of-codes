import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useProfileData() {
  const [data, setData] = useState({
    player: null as any,
    achievements: [] as any[],
    recentBattles: [] as any[],
    mastery: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [
          playerRes,
          achievementsRes,
          battlesRes,
          masteryRes,
        ] = await Promise.all([
          api.get("/users/me"),
          api.get("/users/me/achievements"),
          api.get("/users/me/battles"),
          api.get("/users/me/mastery"),
        ]);

        setData({
          player: playerRes.data,
          achievements: achievementsRes.data,
          recentBattles: battlesRes.data,
          mastery: masteryRes.data,
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
