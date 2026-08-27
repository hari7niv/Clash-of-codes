/**
 * Style system: Tournament Console — shared, believable mock data keeps the UI
 * feeling like a live competitive product while remaining replaceable by services later.
 */
export type Rank = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Master";

export const player = {
  name: "Nia Sharma",
  handle: "niacodes",
  initials: "NS",
  rating: 1842,
  rank: "Platinum" as Rank,
  level: 18,
  xp: 3840,
  xpGoal: 4500,
  winRate: 62,
  wins: 42,
  losses: 26,
  streak: 6,
  peak: 1918,
  battles: 68,
};

export const battleTypes = [
  { id: "blitz", name: "Blitz", time: "05:00", detail: "Fast reads. One decisive pass." },
  { id: "standard", name: "Standard", time: "10:00", detail: "The balanced arena format." },
  { id: "deep", name: "Deep Battle", time: "20:00", detail: "More room for difficult paths." },
];

export const topics = ["Random", "Arrays", "Strings", "Linked Lists", "Trees", "Graphs", "Dynamic Programming", "Greedy", "Searching", "Sorting"];

export const mastery = [
  { topic: "Arrays", value: 82, tone: "lime" },
  { topic: "Strings", value: 71, tone: "blue" },
  { topic: "Trees", value: 53, tone: "amber" },
  { topic: "Graphs", value: 31, tone: "red" },
  { topic: "Dynamic Programming", value: 22, tone: "stone" },
];

export const quests = [
  { icon: "01", title: "Enter the Arena", detail: "Play 1 battle", progress: 0, total: 1, reward: "+120 XP", complete: false },
  { icon: "02", title: "Tree Hunter", detail: "Solve 2 tree problems", progress: 1, total: 2, reward: "+180 XP", complete: false },
  { icon: "03", title: "Keep the Fire", detail: "Maintain your daily streak", progress: 1, total: 1, reward: "+80 XP", complete: true },
];

export const recentBattles = [
  { opponent: "byteharbor", initials: "BH", title: "Minimum Window", topic: "Strings", result: "WIN", delta: "+22", duration: "7:14", level: "Medium" },
  { opponent: "mara.ai", initials: "MA", title: "Course Scheduler", topic: "Graphs", result: "LOSS", delta: "−11", duration: "9:40", level: "Hard" },
  { opponent: "dev.kite", initials: "DK", title: "Merge Intervals", topic: "Arrays", result: "WIN", delta: "+18", duration: "5:28", level: "Medium" },
  { opponent: "eulerjay", initials: "EJ", title: "Tree Diameter", topic: "Trees", result: "WIN", delta: "+25", duration: "8:19", level: "Medium" },
];

export const recommendations = [
  { title: "Graph Signal", subtitle: "Shortest Path / Medium", meta: "Est. 18 min", tag: "Weakness training", accent: "red" },
  { title: "Pattern Shift", subtitle: "Sliding Window / Medium", meta: "Est. 12 min", tag: "Battle prep", accent: "blue" },
  { title: "Daily Drill", subtitle: "Linked List / Easy", meta: "Est. 8 min", tag: "Warm up", accent: "lime" },
];

export const opponents = [
  { name: "Rohan Malik", handle: "rohanbits", initials: "RM", rating: 1856, rank: "Platinum" as Rank, streak: 3, form: [true, true, false, true, true], region: "Mumbai, IN" },
  { name: "Maya Chen", handle: "mchen", initials: "MC", rating: 1811, rank: "Platinum" as Rank, streak: 5, form: [false, true, true, true, false], region: "Singapore" },
];

export const leaderboard = [
  { rank: 1, name: "Ari Voss", handle: "arivoss", initials: "AV", rating: 2844, tier: "Master" as Rank, rate: "74%", trend: "+38", streak: 9, tone: "amber" },
  { rank: 2, name: "Noah Park", handle: "noahp", initials: "NP", rating: 2791, tier: "Master" as Rank, rate: "71%", trend: "+16", streak: 5, tone: "blue" },
  { rank: 3, name: "Sofia Iqbal", handle: "sofia.codes", initials: "SI", rating: 2712, tier: "Diamond" as Rank, rate: "69%", trend: "+48", streak: 11, tone: "red" },
  { rank: 4, name: "Ethan Cole", handle: "ecole", initials: "EC", rating: 2640, tier: "Diamond" as Rank, rate: "67%", trend: "+4", streak: 2, tone: "lime" },
  { rank: 5, name: "Asha Menon", handle: "asham", initials: "AM", rating: 2578, tier: "Diamond" as Rank, rate: "65%", trend: "+24", streak: 6, tone: "amber" },
  { rank: 6, name: "Lucas Hill", handle: "lucash", initials: "LH", rating: 2494, tier: "Diamond" as Rank, rate: "63%", trend: "−6", streak: 1, tone: "blue" },
  { rank: 7, name: "Nia Sharma", handle: "niacodes", initials: "NS", rating: 1842, tier: "Platinum" as Rank, rate: "62%", trend: "+18", streak: 6, tone: "red" },
];

export const achievements = [
  { title: "First Blood", text: "Win your first battle.", state: "earned", mark: "01" },
  { title: "Speed Demon", text: "Solve with time in reserve.", state: "earned", mark: "02" },
  { title: "Tree Surgeon", text: "Win 10 tree battles.", state: "progress", mark: "03" },
  { title: "Giant Slayer", text: "Defeat a higher-rated opponent.", state: "locked", mark: "04" },
];

export const codeSnippet = `function minWindow(s: string, t: string): string {
  const need = new Map<string, number>();
  for (const char of t) need.set(char, (need.get(char) ?? 0) + 1);

  let left = 0;
  let matched = 0;
  let best = [0, Infinity];

  for (let right = 0; right < s.length; right++) {
    const char = s[right];
    // your implementation
  }

  return best[1] === Infinity ? "" : s.slice(best[0], best[1] + 1);
}`;
