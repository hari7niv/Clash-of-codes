/**
 * Style system: ClashOfCode Tournament Console — a deliberate left identity rail and a measured
 * workspace header create a single continuous competition desk rather than separate chrome pieces.
 */
import { Link, useLocation } from "wouter";
import { Bell, BookOpen, ChevronRight, Crosshair, Flame, Home, Menu, Plus, Settings, Swords, Trophy, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, RankBadge } from "./ArenaPrimitives";
import { usePlayerData } from "@/hooks/usePlayerData";

const navItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/battle", label: "Battle", icon: Swords },
  { href: "/practice", label: "Practice", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { player } = usePlayerData();
  const closeMobile = () => setMobileOpen(false);
  const isActive = (href: string) => href === "/app" ? location === "/app" : location.startsWith(href);

  return <div className="app-shell text-[#f3f0ea] selection:bg-[#f04432] selection:text-white">
    <header className="mobile-topbar">
      <Link href="/app" className="flex items-center gap-2" onClick={closeMobile}><img src="/manus-storage/codeclash-mark_03d4d311.png" alt="ClashOfCode" className="h-8 w-8 object-contain" /><span className="font-display text-base font-bold tracking-[-.06em]">CLASHOFCODE</span></Link>
      <div className="flex items-center gap-2"><Link href="/rooms/create" className="mobile-create-room" aria-label="Create room" onClick={closeMobile}><Plus className="h-3.5 w-3.5" /><span>Create room</span></Link><button className="icon-button h-8 w-8" aria-label="Open navigation" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
    </header>
    <aside className={`arena-rail ${mobileOpen ? "is-open" : ""}`}>
      <div className="rail-brand"><Link href="/app" className="flex items-center gap-3" onClick={closeMobile}><img src="/manus-storage/codeclash-mark_03d4d311.png" alt="ClashOfCode" className="h-11 w-11 object-contain" /><span><span className="block font-display text-[1.35rem] font-bold leading-none tracking-[-.085em]">CLASHOFCODE</span><span className="mt-1.5 block font-mono text-[8px] tracking-[.17em] text-[#747783]">COMPETITIVE CODING ARENA</span></span></Link></div>
      <div className="rail-section-label">Navigate</div>
      <nav className="mt-3 flex flex-col gap-1" aria-label="Main navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={closeMobile} className={`rail-link ${isActive(href) ? "is-active" : ""}`}><Icon className="h-[17px] w-[17px]" /><span>{label}</span>{isActive(href) && <ChevronRight className="ml-auto h-4 w-4" />}</Link>)}</nav>
      <div className="rail-match-action"><span className="rail-section-label">Matchmaking</span><Link href="/matchmaking" onClick={closeMobile} className="battle-rail-cta"><Crosshair className="h-4 w-4" /><span>Find opponent</span></Link></div>
      <div className="mt-auto px-4 pb-5">
        {player ? (
          <Link href="/profile" onClick={closeMobile} className={`profile-rail ${location.startsWith("/profile") ? "is-active" : ""}`}><Avatar initials={player.initials} tone="red" size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#eeeef0]">{player.handle}</span><span className="block font-mono text-[9px] text-[#747783]">{player.rating} RATING</span></span><RankBadge rank={player.rank} className="scale-90 origin-right" /></Link>
        ) : (
          <div className="h-12 w-full animate-pulse bg-white/5 rounded"></div>
        )}
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={closeMobile} />}
    <main className="app-canvas"><div className="desktop-topline"><div className="flex min-w-0 items-center gap-3"><span className="section-kicker">Competitive desk</span><span className="topline-divider" /><span className="topline-live"><span className="live-dot" /> Arena live</span><span className="font-mono text-[9px] tracking-[.13em] text-[#747783]">SEASON 03 / WEEK 07</span></div><div className="ml-auto flex items-center gap-2"><Link href="/rooms/create" className="topline-action"><Plus className="h-3.5 w-3.5" />Create room</Link><button className="icon-button h-8 w-8" aria-label="Notifications"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f04432]" /></button><span className="topline-run"><Flame className="h-3 w-3 text-[#e1a759]" />{player?.streak || 0} day run</span></div></div><div className="app-workspace">{children}</div></main>
  </div>;
}
