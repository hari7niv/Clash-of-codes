import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function usePracticeData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [drillsRes, recsRes, signalRes, streakRes] = await Promise.all([
          api.get("/practice/drills").catch(() => ({ data: [] })),
          api.get("/practice/recommendations").catch(() => ({ data: [] })),
          api.get("/practice/training-signal").catch(() => ({ data: null })),
          api.get("/practice/streak").catch(() => ({ data: null }))
        ]);

        setData({
          drills: drillsRes.data,
          recommendations: recsRes.data,
          trainingSignal: signalRes.data,
          streakData: streakRes.data
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
