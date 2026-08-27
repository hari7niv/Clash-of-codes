/**
 * Style system: Tournament Console — the dashboard makes the next battle the narrative lead,
 * with editorial asymmetry, compact data blocks, and a visible match line.
 */
import { Avatar, IconLabel, MatchLine, Meter, Pill, RankBadge, StatBlock, Streak, Trend } from "@/components/ArenaPrimitives";
import { mastery, player, quests, recentBattles, recommendations } from "@/data/mockData";
import { ArrowUpRight, Check, ChevronRight, Crosshair, Dices, Link2, Medal, Sparkles, Swords, Target, Timer, Trophy } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  return <div className="page-wrap enter-up">
    <section style={{ width: "100%", maxWidth: "none" }} className="relative w-full min-h-[380px] overflow-hidden border border-white/10 bg-[#191a20] p-5 sm:p-8 lg:p-9">
      <div className="noise absolute inset-0 bg-cover bg-center opacity-[.54]" style={{ backgroundImage: "linear-gradient(90deg, #17181d 0%, rgba(23,24,29,.92) 37%, rgba(23,24,29,.22) 100%), url('/manus-storage/codeclash-hero-arena_d5f624c0.jpg')" }} />
      <div className="relative z-10 flex min-h-[316px] max-w-[700px] flex-col">
        <MatchLine label="Home / field report" className="mb-8 sm:mb-10" />
        <div className="mt-auto">
          <div className="mb-5"><Pill tone="red"><span className="live-dot" /> Ready room</Pill></div>
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[#aaaeb9]">Ranked 1v1 // Standard pool</p>
          <h1 className="mt-3 max-w-[570px] font-display text-[2.4rem] font-bold leading-[.96] tracking-[-.065em] text-[#f6f3ed] sm:text-[3.05rem] lg:text-[3.45rem]">Your next rating point is on the clock.</h1>
          <p className="mt-5 max-w-[450px] text-sm leading-6 text-[#b1b4bc]">One deliberate battle is all it takes to move the needle. The arena is matching players in your range now.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link href="/matchmaking" className="primary-button"><Crosshair className="h-4 w-4" />Find opponent</Link><Link href="/join" className="secondary-button"><Link2 className="h-4 w-4" />Join room</Link></div>
        </div>
      </div>
      <div className="relative z-10 mt-6 grid grid-cols-2 border-t border-white/10 pt-4 sm:flex sm:w-[560px] sm:justify-between">
        <StatBlock label="Current rating" value={player.rating} detail="+18 this week" accent /><StatBlock label="Global rank" value="#2,408" detail="Top 12%" /><StatBlock label="Win streak" value="3" detail="personal best: 6" /><StatBlock label="Level" value={player.level} detail="660 XP to next" />
      </div>
    </section>

    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.76fr)]">
      <div className="space-y-4">
        <section className="panel p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4"><div><p className="section-kicker">Daily objective board</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Today’s quests</h2></div><Link href="/practice" className="inline-flex items-center gap-1 text-xs font-medium text-[#aeb1ba] hover:text-white">View all <ChevronRight className="h-3.5 w-3.5" /></Link></div>
          <div className="mt-5 divide-y divide-white/[.08]">
            {quests.map((quest) => <div key={quest.title} className="flex gap-3 py-4 first:pt-0 last:pb-0"><div className={`flex h-9 w-9 flex-none items-center justify-center border font-mono text-[10px] ${quest.complete ? "border-[#b5df73]/40 bg-[#b5df73]/10 text-[#cde7a5]" : "border-white/10 bg-white/[.035] text-[#8d909b]"}`}>{quest.complete ? <Check className="h-4 w-4" /> : quest.icon}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#e8e8ea]">{quest.title}</p><Pill tone={quest.complete ? "lime" : "neutral"}>{quest.reward}</Pill></div><p className="mt-1 text-xs text-[#898c97]">{quest.detail}</p><div className="mt-3"><Meter value={(quest.progress / quest.total) * 100} tone="lime" /></div><p className="mt-1.5 font-mono text-[10px] text-[#70737e]">{quest.progress} / {quest.total} {quest.complete ? "COMPLETE" : "PROGRESS"}</p></div></div>)}
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="flex items-end justify-between"><div><p className="section-kicker">Match archive</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Recent battles</h2></div><Link href="/profile" className="text-xs font-medium text-[#aeb1ba] hover:text-white">Full history</Link></div>
          <div className="mt-5 overflow-x-auto"><table className="min-w-[600px] w-full text-left"><thead><tr className="border-b border-white/[.08] font-mono text-[10px] uppercase tracking-[.1em] text-[#747783]"><th className="pb-3 font-medium">Opponent</th><th className="pb-3 font-medium">Problem</th><th className="pb-3 font-medium">Result</th><th className="pb-3 font-medium">Time</th><th className="pb-3 text-right font-medium">Rating</th></tr></thead><tbody>{recentBattles.map((battle) => <tr key={battle.opponent} className="border-b border-white/[.055] last:border-0"><td className="py-3.5"><div className="flex items-center gap-2.5"><Avatar initials={battle.initials} tone={battle.result === "WIN" ? "blue" : "stone"} size="sm" /><span><span className="block text-xs font-semibold text-[#dadbe0]">{battle.opponent}</span><span className="mt-0.5 block font-mono text-[9px] text-[#747783]">{battle.level.toUpperCase()}</span></span></div></td><td className="py-3.5"><span className="block text-xs text-[#d5d6db]">{battle.title}</span><span className="mt-0.5 block font-mono text-[9px] text-[#747783]">{battle.topic.toUpperCase()}</span></td><td className="py-3.5"><Pill tone={battle.result === "WIN" ? "lime" : "red"}>{battle.result}</Pill></td><td className="py-3.5 font-mono text-xs text-[#a9acb4]">{battle.duration}</td><td className={`py-3.5 text-right font-mono text-xs ${battle.result === "WIN" ? "text-[#b5df73]" : "text-[#e48b87]"}`}>{battle.delta}</td></tr>)}</tbody></table></div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="panel overflow-hidden p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="section-kicker">Skill field</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Topic mastery</h2></div><Target className="h-5 w-5 text-[#f04432]" /></div><p className="mt-3 text-xs leading-5 text-[#90939d]">Your strongest pattern is arrays. Graphs are the clearest chance to improve this week.</p><div className="mt-6 space-y-4">{mastery.map((item) => <div key={item.topic}><div className="mb-2 flex justify-between"><span className="text-xs font-medium text-[#d7d8dc]">{item.topic}</span><span className="font-mono text-[10px] text-[#858893]">{item.value}%</span></div><Meter value={item.value} tone="lime" /></div>)}</div><Link href="/profile" className="mt-6 flex items-center justify-between border-t border-white/[.08] pt-4 text-xs font-medium text-[#c7c9d0] hover:text-white">Open mastery report <ArrowUpRight className="h-3.5 w-3.5" /></Link></section>
        <section className="panel overflow-hidden"><div className="relative min-h-[190px] bg-cover bg-center p-5" style={{ backgroundImage: "linear-gradient(90deg, rgba(24,25,31,.93), rgba(24,25,31,.45)), url('/manus-storage/codeclash-mastery_2fb8de06.jpg')" }}><div className="relative z-10"><Pill tone="blue"><Sparkles className="h-3 w-3" /> Coach / upcoming</Pill><h2 className="mt-4 max-w-[230px] font-display text-2xl font-bold leading-[1] tracking-[-.055em]">Your game data, explained.</h2><p className="mt-3 max-w-[230px] text-xs leading-5 text-[#c3c6ce]">A future arena coach will turn every close loss into a focused plan.</p></div></div><div className="p-4"><IconLabel icon={Timer}>Personal baseline improved 2m 21s this month</IconLabel></div></section>
      </aside>
    </div>

    <section className="mt-4 panel p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-kicker">Training queue</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Recommended practice</h2></div><Link href="/practice" className="secondary-button min-h-9 px-3 text-xs">Open practice</Link></div><div className="mt-5 grid gap-3 md:grid-cols-3">{recommendations.map((item, index) => <Link href="/practice" key={item.title} className="group border border-white/[.09] bg-white/[.018] p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.04]"><div className="flex items-start justify-between"><span className={`font-mono text-[10px] ${item.accent === "red" ? "text-[#ff8d81]" : item.accent === "blue" ? "text-[#a6bdff]" : "text-[#cde7a5]"}`}>0{index + 1} / {item.tag.toUpperCase()}</span><ArrowUpRight className="h-4 w-4 text-[#747783] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" /></div><h3 className="mt-6 font-display text-lg font-bold tracking-[-.04em]">{item.title}</h3><p className="mt-1 text-xs text-[#979aa4]">{item.subtitle}</p><div className="mt-4 flex items-center gap-2"><Timer className="h-3.5 w-3.5 text-[#727580]" /><span className="font-mono text-[10px] text-[#848792]">{item.meta.toUpperCase()}</span></div></Link>)}</div></section>
  </div>;
}
