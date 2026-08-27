/**
 * Style system: ClashOfCode Tournament Console — public pages share the arena’s graphite,
 * editorial typography, and red action signal without inheriting the authenticated side rail.
 */
import { ArrowRight, Crosshair, Signal, Trophy } from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "wouter";

export default function PublicShell({ children, authView }: { children: ReactNode; authView?: "login" | "signup" }) {
  const action = authView === "login" ? { href: "/signup", label: "Sign up" } : { href: "/login", label: "Log in" };
  return <div className="public-shell"><header className="public-header"><nav className="public-nav" aria-label="Public navigation"><Link href="/" className="public-brand"><img src="/manus-storage/codeclash-mark_03d4d311.png" alt="ClashOfCode" /><span><b>CLASHOFCODE</b><small>COMPETITIVE CODING ARENA</small></span></Link><div className="flex items-center gap-2"><Link href={action.href} className="public-nav-link">{action.label}</Link>{!authView && <Link href="/signup" className="public-nav-cta">Sign up <ArrowRight className="h-3.5 w-3.5" /></Link>}</div></nav><div className="public-status-strip"><span className="public-status-live"><span className="live-dot" />ARENA LIVE</span><span className="public-strip-line" /><span><Signal className="h-3.5 w-3.5" />21 OPEN QUEUES</span><span><Trophy className="h-3.5 w-3.5" />SEASON 03</span><span className="ml-auto hidden sm:inline">RANKED MATCH DESK</span></div></header>{children}<footer className="public-footer"><span className="font-mono text-[10px] tracking-[.14em] text-[#6f727d]">CLASHOFCODE / LIVE PRACTICE ARENA</span><div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#a0a3ad]"><a href="#about">About</a><Link href="/leaderboard">Leaderboard</Link><Link href="/login">Login</Link><Link href="/signup">Signup</Link></div></footer></div>;
}
