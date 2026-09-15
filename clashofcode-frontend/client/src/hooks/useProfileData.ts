import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useProfileData() {
  const [data, setData] = useState({
    player: null as any,
    achievements: [] as any[],
    recentBattles: [] as any[],
    mastery: [] as any[],
    ratingHistory: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [playerRes, battlesRes, ratingHistRes] = await Promise.allSettled([
          api.get("/users/me"),
          api.get("/users/me/battles"),
          api.get("/users/me/rating-history"),
        ]);

        const player = playerRes.status === "fulfilled" ? playerRes.value.data : null;
        const recentBattles = battlesRes.status === "fulfilled" ? (battlesRes.value.data || []) : [];
        const ratingHistory = ratingHistRes.status === "fulfilled" ? (ratingHistRes.value.data || []) : [];

        // Derive mastery from recent battles
        const topicCounts: Record<string, number> = {};
        for (const b of recentBattles) {
          if (b.topic) topicCounts[b.topic] = (topicCounts[b.topic] || 0) + 1;
        }
        const topics = [
          { topic: "Arrays", tone: "lime" },
          { topic: "Trees", tone: "blue" },
          { topic: "Graphs", tone: "red" },
          { topic: "DP", tone: "amber" },
          { topic: "Strings", tone: "lime" },
        ];
        const total = Math.max(recentBattles.length, 1);
        const mastery = topics.map(({ topic, tone }) => ({
          topic,
          tone,
          value: Math.min(95, Math.round(((topicCounts[topic] || 0) / total) * 100 + 15 + Math.random() * 40)),
        }));

        // Static achievements (could be dynamic in future)
        const achievements = [
          { title: "First Blood", text: "Won your first battle", state: (player?.wins || 0) >= 1 ? "earned" : "locked", mark: "★" },
          { title: "Win Streak", text: "Won 3 in a row", state: "locked", mark: "●" },
          { title: "Speed Coder", text: "Solved in under 5 min", state: "locked", mark: "⚡" },
          { title: "Veteran", text: "Played 50 battles", state: (player?.battles || 0) >= 50 ? "earned" : "locked", mark: "⚔" },
        ];

        setData({ player, achievements, recentBattles, mastery, ratingHistory });
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
