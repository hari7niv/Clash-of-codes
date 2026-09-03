import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useSettingsData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const playerRes = await api.get("/users/me");
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
    try {
      const response = await api.patch("/users/me", updates);
      
      // Update local state with the response
      setData((prev: any) => ({
        ...prev,
        player: response.data,
      }));
      
      return response.data;
    } catch (err) {
      throw err;
    }
  };

  return { ...data, loading, error, updateProfile };
}
