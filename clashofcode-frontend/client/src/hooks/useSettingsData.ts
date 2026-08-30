import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useSettingsData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [playerRes] = await Promise.all([
          api.get("/users/me").catch(() => ({ data: null }))
        ]);

        setData({
          player: playerRes.data,
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const updateProfile = async (updates: any) => {
    // In a real app this would be a PATCH to /users/me
    setData((prev: any) => ({
      ...prev,
      player: { ...prev.player, ...updates }
    }));
  };

  return { ...data, loading, error, updateProfile };
}
