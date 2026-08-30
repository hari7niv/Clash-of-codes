import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function usePlayerData() {
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get("/users/me");
        setPlayer(res.data);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { player, loading, error };
}
