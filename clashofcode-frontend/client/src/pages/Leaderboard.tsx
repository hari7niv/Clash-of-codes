/**
 * Style system: Tournament Console — the leaderboard reads as an editorial standings board,
 * using rank, movement, and form to make competitive progress intelligible at a glance.
 */
import { Avatar, MatchLine, Pill, RankBadge, Streak, Trend } from "@/components/ArenaPrimitives";
import { ArrowUpRight, Crown, Medal, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";

const tabs = ["Global", "Weekly", "Friends", "Country", "Topic", "Rising Stars"];

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState("Global");
  const { player, leaderboard, loading, error, userRank, total } = useLeaderboardData(activeTab);

  if (loading) {
    return <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">Loading leaderboard...</div>;
  }
  if (error || !player) {
    return <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">Error loading leaderboard.</div>;
  }

  // Calculate rating needed to next tier
  const currentRating = player.rating || 1500;
  const nextTierThreshold = currentRating >= 2400 ? 2400 : 
                           currentRating >= 2000 ? 2400 : 
                           currentRating >= 1800 ? 2000 : 
                           currentRating >= 1600 ? 1800 : 1600;
  const ratingToNextTier = Math.max(0, nextTierThreshold - currentRating);

  return <div className="page-wrap enter-up"><header><MatchLine label={`Rankings / ${activeTab.toLowerCase()}`} /><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">The standings.</h1><p className="mt-2 max-w-lg text-sm leading-6 text-[#989ba5]">Current competitors, current momentum. Climb by playing well—not just by playing often.</p></div></div></header><div className="mt-7 flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button onClick={() => setActiveTab(tab)} className={`topic-button whitespace-nowrap ${activeTab === tab ? "is-selected" : ""}`} key={tab}>{tab}</button>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.72fr)]"><section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.08] p-5 sm:p-6"><div><p className="section-kicker">{activeTab} ladder</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Top competitors</h2></div><span className="font-mono text-[10px] text-[#747783]">{total} TOTAL PLAYERS</span></div><div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left"><thead><tr className="border-b border-white/[.07] font-mono text-[10px] uppercase tracking-[.1em] text-[#747783]"><th className="px-5 py-3 font-medium sm:px-6">Rank</th><th className="py-3 font-medium">Competitor</th><th className="py-3 font-medium">Rating</th><th className="py-3 font-medium">Win rate</th><th className="py-3 font-medium">Streak</th><th className="px-5 py-3 text-right font-medium sm:px-6">Trend</th></tr></thead><tbody>{leaderboard.map((entry) => <tr key={entry.rank} className={`border-b border-white/[.055] last:border-0 ${entry.name === player.name ? "bg-[#f04432]/[.07]" : ""}`}><td className="px-5 py-4 sm:px-6"><span className={`font-display text-lg font-bold ${entry.rank < 4 ? "text-[#edc286]" : "text-[#777a85]"}`}>#{entry.rank}</span></td><td className="py-4"><div className="flex items-center gap-3"><Avatar initials={entry.initials} tone={entry.tone} /><div><div className="flex items-center gap-2"><span className="text-sm font-semibold text-[#e0e1e5]">{entry.name}</span>{entry.name === player.name && <Pill tone="red" className="scale-90 origin-left">You</Pill>}</div><span className="mt-1 block font-mono text-[10px] text-[#777a85]">{entry.handle}</span></div></div></td><td className="py-4"><span className="font-mono text-sm text-[#e1e2e5]">{entry.rating}</span><RankBadge rank={entry.tier} className="ml-2" /></td><td className="py-4 font-mono text-xs text-[#b7bac2]">{entry.rate}</td><td className="py-4"><Streak value={entry.streak} compact /></td><td className="px-5 py-4 text-right sm:px-6"><Trend negative={entry.trend.startsWith("−")}>{entry.trend}</Trend></td></tr>)}</tbody></table></div></section><aside className="space-y-5"><section className="panel p-5"><div className="flex justify-between"><div><p className="section-kicker">Your position</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">#{userRank || "N/A"}</h2></div><Medal className="h-5 w-5 text-[#f04432]" /></div><p className="mt-3 text-xs leading-5 text-[#9295a0]">Your current standing in the {activeTab.toLowerCase()} leaderboard. Keep playing to climb higher!</p><div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[.08] pt-5"><div><span className="section-kicker">Rating</span><p className="mt-1 font-mono text-lg">{player.rating}</p></div><div><span className="section-kicker">To next tier</span><p className="mt-1 font-mono text-lg text-[#f4877b]">{ratingToNextTier > 0 ? `+${ratingToNextTier}` : "Max tier"}</p></div></div></section><section className="panel p-5"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#83a8ff]" /><p className="section-kicker">Rising stars</p></div><p className="mt-4 font-display text-xl font-bold tracking-[-.05em]">Momentum matters here.</p><p className="mt-2 text-xs leading-5 text-[#9295a0]">This view rewards the sharpest improvement, not only the highest rating.</p><button onClick={() => setActiveTab("Rising Stars")} className="secondary-button mt-5 w-full">View rising stars <ArrowUpRight className="h-4 w-4" /></button></section></aside></div></div>;
}
