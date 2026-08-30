import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useFriendsData() {
  const [data, setData] = useState({
    friends: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [friendsRes] = await Promise.all([
          api.get("/friends/friends").catch(() => api.get("/friends")), // Fallback in case route path is just /friends
        ]);

        setData({
          friends: friendsRes.data || [],
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
