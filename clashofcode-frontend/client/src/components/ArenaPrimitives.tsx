/**
 * Style system: Tournament Console — tactile graphite cards, rank chevrons,
 * compact number blocks, and the recurring red match-line unify every screen.
 */
import { cn } from "@/lib/utils";
import { ChevronUp, Flame, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function MatchLine({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {label && <span className="section-kicker whitespace-nowrap">{label}</span>}
      <span className="h-px flex-1 bg-white/10" />
      <span className="h-1.5 w-1.5 rotate-45 bg-[#f04432]" />
    </div>
  );
}

export function RankBadge({ rank, className }: { rank: string; className?: string }) {
  return <span className={cn("rank-badge", className)}><span className="rank-notch" />{rank}</span>;
}

export function Avatar({ initials, tone = "red", size = "md" }: { initials: string; tone?: string; size?: "sm" | "md" | "lg" }) {
  const shades: Record<string, string> = {
    red: "from-[#f04432] to-[#8f1d22]",
    blue: "from-[#6f9af8] to-[#314da3]",
    lime: "from-[#b5df73] to-[#547436]",
    amber: "from-[#e1a759] to-[#8b5625]",
    stone: "from-[#9c9ea4] to-[#4e5058]",
  };
  const sizeClass = { sm: "h-8 w-8 text-[10px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-sm" }[size];
  return <span className={cn("avatar-face bg-gradient-to-br", shades[tone] ?? shades.red, sizeClass)}>{initials}</span>;
}

export function StatBlock({ label, value, detail, accent = false, className }: { label: string; value: string | number; detail?: string; accent?: boolean; className?: string }) {
  return (
    <div className={cn("stat-block", className)}>
      <span className="section-kicker">{label}</span>
      <div className={cn("mt-1 font-display text-2xl font-bold tracking-[-0.055em]", accent && "text-[#f04432]")}>{value}</div>
      {detail && <p className="mt-1 text-xs text-[#8d909b]">{detail}</p>}
    </div>
  );
}

export function Meter({ value, tone = "red", showValue = false }: { value: number; tone?: string; showValue?: boolean }) {
  const tones: Record<string, string> = { red: "bg-[#f04432]", lime: "bg-[#b5df73]", blue: "bg-[#83a8ff]", amber: "bg-[#e1a759]", stone: "bg-[#747783]" };
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={cn("h-full rounded-full transition-all duration-500", tones[tone] ?? tones.red)} style={{ width: `${value}%` }} />
      </div>
      {showValue && <span className="w-8 font-mono text-xs text-[#d5d7dd]">{value}%</span>}
    </div>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "red" | "lime" | "blue" | "amber"; className?: string }) {
  const tones = { neutral: "border-white/10 bg-white/[0.045] text-[#adb0bb]", red: "border-[#f04432]/25 bg-[#f04432]/10 text-[#ff877a]", lime: "border-[#b5df73]/20 bg-[#b5df73]/10 text-[#cde7a5]", blue: "border-[#83a8ff]/20 bg-[#83a8ff]/10 text-[#b4c8ff]", amber: "border-[#e1a759]/20 bg-[#e1a759]/10 text-[#edc286]" };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em]", tones[tone], className)}>{children}</span>;
}

export function IconLabel({ icon: Icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 text-xs text-[#a5a8b2]", className)}><Icon className="h-3.5 w-3.5" />{children}</span>;
}

export function Streak({ value, compact = false }: { value: number; compact?: boolean }) {
  return <span className={cn("inline-flex items-center gap-1.5 font-mono font-medium text-[#e9bd6e]", compact ? "text-xs" : "text-sm")}><Flame className={cn("fill-[#e39b4e] text-[#efb66a]", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />{value}{compact ? "" : " day streak"}</span>;
}

export function Trend({ children, negative = false }: { children: ReactNode; negative?: boolean }) {
  return <span className={cn("inline-flex items-center gap-0.5 font-mono text-xs", negative ? "text-[#e48b87]" : "text-[#b5df73]")}><ChevronUp className={cn("h-3.5 w-3.5", negative && "rotate-180")} />{children}</span>;
}
