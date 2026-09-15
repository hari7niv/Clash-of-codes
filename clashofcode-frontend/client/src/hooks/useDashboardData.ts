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
        // Fetch in parallel — fail gracefully per item
        const [playerRes, questsRes, battlesRes, problemsRes] = await Promise.allSettled([
          api.get("/users/me"),
          api.get("/quests/today"),
          api.get("/users/me/battles"),
          api.get("/problems?limit=6"), // used for practice recommendations
        ]);

        const player = playerRes.status === "fulfilled" ? playerRes.value.data : null;
        const quests = questsRes.status === "fulfilled" ? (questsRes.value.data || []) : [];
        const recentBattles = battlesRes.status === "fulfilled" ? (battlesRes.value.data || []) : [];
        const problems = problemsRes.status === "fulfilled" ? (problemsRes.value.data?.items || []) : [];

        // Derive mastery from recent battles (topic frequency)
        const topicCounts: Record<string, number> = {};
        for (const b of recentBattles) {
          if (b.topic) topicCounts[b.topic] = (topicCounts[b.topic] || 0) + 1;
        }
        const topics = ["Arrays", "Trees", "Graphs", "DP", "Strings", "Math"];
        const mastery = topics.map((topic) => ({
          topic,
          value: Math.min(100, Math.round(((topicCounts[topic] || 0) / Math.max(recentBattles.length, 1)) * 100 + Math.random() * 30)),
        }));

        // Map problems to practice recommendations
        const recommendations = problems.slice(0, 3).map((p: any, i: number) => ({
          title: p.title,
          subtitle: `Difficulty: ${p.difficulty}`,
          tag: p.topic || "Practice",
          meta: `~20-40 min`,
          accent: i === 0 ? "red" : i === 1 ? "blue" : "lime",
          id: p.id,
        }));

        setData({ player, quests, recentBattles, mastery, recommendations });
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
