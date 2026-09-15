/**
 * Style system: Tournament Console — the profile is a composed competitive record that
 * pairs decisive headline metrics with a quieter craft-focused mastery history.
 */
import { Avatar, MatchLine, Meter, Pill, RankBadge, StatBlock, Streak, Trend } from "@/components/ArenaPrimitives";
import { Award, BarChart3, CalendarDays, Edit3, Flame, Sparkles, Trophy } from "lucide-react";
import { Link } from "wouter";
import { useProfileData } from "@/hooks/useProfileData";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";

export default function Profile() {
  const { player, achievements, mastery, recentBattles, ratingHistory, loading, error } = useProfileData();

  if (loading) {
    return <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">Loading profile...</div>;
  }
  if (error || !player) {
    return <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">Error loading profile.</div>;
  }

  // Format rating history for recharts
  const chartData = ratingHistory?.map(entry => ({
    date: new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    rating: entry.newRating
  })) || [];

  return <div className="page-wrap enter-up"><section className="border border-white/10 bg-[#18191f] p-5 sm:p-7"><MatchLine label="Player dossier / public profile" /><div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-4"><Avatar initials={player.initials} size="lg" /><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-3xl font-bold tracking-[-.065em]">{player.name}</h1><Pill tone="red">Online</Pill></div><p className="mt-1 font-mono text-[11px] text-[#8b8e98]">@{player.handle} · Mumbai, IN</p><div className="mt-3 flex flex-wrap items-center gap-2"><RankBadge rank={player.rank} /><span className="font-mono text-sm text-[#e4e4e6]">{player.rating} rating</span><span className="h-3 w-px bg-white/15" /><Streak value={player.streak} compact /></div></div></div><Link href="/profile/edit" className="secondary-button"><Edit3 className="h-4 w-4" />Edit profile</Link></div><div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/[.08] pt-5 sm:grid-cols-5"><StatBlock label="Level" value={player.level} detail="4,020 XP" /><StatBlock label="Win rate" value={`${player.winRate}%`} detail="42 victories" /><StatBlock label="Battles" value={player.battles} detail="season total" /><StatBlock label="Peak rating" value={player.peak} detail="all-time" /><StatBlock label="Current streak" value={player.streak} detail="days active" /></div></section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)]"><div className="space-y-5"><section className="panel p-5 sm:p-7"><div className="flex items-end justify-between"><div><p className="section-kicker">Rating trajectory</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Steady in the climb</h2></div><Trend>+73 / 30 days</Trend></div><div className="mt-7 h-44 border-b border-l border-white/[.09] bg-[linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:100%_36px] p-3">
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f04432" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f04432" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18191f', borderColor: 'rgba(255,255,255,0.1)', fontSize: '12px' }}
              itemStyle={{ color: '#f04432' }}
            />
            <Area type="monotone" dataKey="rating" stroke="#f04432" strokeWidth={2} fillOpacity={1} fill="url(#colorRating)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full flex items-center justify-center text-xs text-[#747783]">No rating history yet</div>
      )}
    </div><div className="mt-3 flex justify-between font-mono text-[10px] text-[#747783]"><span>{chartData[0]?.date || 'START'}</span><span>{chartData[chartData.length - 1]?.date || 'NOW'}</span></div></section><section className="panel p-5 sm:p-7"><div><p className="section-kicker">Battle record</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Recent match history</h2></div><div className="mt-5 space-y-2">{recentBattles.map((battle) => <div key={battle.opponent} className="flex flex-wrap items-center gap-3 border border-white/[.07] bg-white/[.02] px-3 py-3"><Avatar initials={battle.initials} tone={battle.result === "WIN" ? "blue" : "stone"} size="sm" /><div className="min-w-[145px] flex-1"><p className="text-xs font-semibold text-[#dbdce0]">{battle.title}</p><p className="mt-1 font-mono text-[9px] text-[#777a84]">VS {battle.opponent.toUpperCase()}</p></div><Pill tone={battle.result === "WIN" ? "lime" : "red"}>{battle.result}</Pill><span className="font-mono text-xs text-[#8d909a]">{battle.duration}</span><span className={`ml-auto font-mono text-xs ${battle.result === "WIN" ? "text-[#b5df73]" : "text-[#e48b87]"}`}>{battle.delta}</span></div>)}</div></section></div><aside className="space-y-5"><section className="panel overflow-hidden"><div className="relative min-h-[160px] bg-cover bg-center p-5" style={{ backgroundImage: "linear-gradient(90deg, rgba(24,25,31,.92), rgba(24,25,31,.30)), url('/manus-storage/codeclash-mastery_2fb8de06.jpg')" }}><div className="relative z-10"><p className="section-kicker">Mastery map</p><h2 className="mt-2 max-w-[230px] font-display text-2xl font-bold leading-[1] tracking-[-.055em]">Strong in patterns. Ready to widen the field.</h2></div></div><div className="space-y-4 p-5">{mastery.map((item) => <div key={item.topic}><div className="mb-2 flex justify-between text-xs"><span className="text-[#d4d5da]">{item.topic}</span><span className="font-mono text-[#888b95]">{item.value}%</span></div><Meter value={item.value} tone={item.tone} /></div>)}</div></section><section className="panel p-5"><div className="flex items-center gap-2"><Award className="h-4 w-4 text-[#e1a759]" /><p className="section-kicker">Achievement case</p></div><div className="mt-5 grid grid-cols-2 gap-2">{achievements.map((achievement) => <div key={achievement.title} className={`min-h-28 border p-3 ${achievement.state === "earned" ? "border-[#e1a759]/25 bg-[#e1a759]/[.06]" : "border-white/[.08] bg-white/[.025]"}`}><span className={`font-mono text-[10px] ${achievement.state === "earned" ? "text-[#edc286]" : "text-[#6d707a]"}`}>{achievement.mark}</span><p className="mt-4 text-xs font-semibold text-[#d6d7dc]">{achievement.title}</p><p className="mt-1 text-[10px] leading-4 text-[#858893]">{achievement.text}</p></div>)}</div></section></aside></div></div>;
}
