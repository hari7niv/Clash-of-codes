/**
 * Tournaments — FR-10.1
 * Browse, register and track competitive tournaments.
 */
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { MatchLine, Pill } from "@/components/ArenaPrimitives";
import { CalendarDays, Trophy, Users, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface Tournament {
  id: string;
  name: string;
  description?: string;
  format: string;
  status: string;
  maxParticipants: number;
  startTime?: string;
  prizeDescription?: string;
  participantCount?: number;
}

const STATUS_LABELS: Record<string, { label: string; tone: "red" | "lime" | "blue" | "neutral" | "amber" }> = {
  upcoming: { label: "Upcoming", tone: "blue" },
  registration: { label: "Open", tone: "lime" },
  active: { label: "Live", tone: "red" },
  completed: { label: "Ended", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | "registration" | "active">("all");

  useEffect(() => {
    const query = tab === "all" ? "" : `?status=${tab}`;
    setLoading(true);
    api.get(`/tournaments${query}`)
      .then(r => setTournaments(r.data || []))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const register = async (id: string) => {
    setRegistering(id);
    try {
      await api.post(`/tournaments/${id}/register`);
      setRegistered(prev => new Set([...prev, id]));
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message;
      if (msg === "Already registered") setRegistered(prev => new Set([...prev, id]));
    } finally {
      setRegistering(null);
    }
  };

  const withdraw = async (id: string) => {
    setRegistering(id);
    try {
      await api.delete(`/tournaments/${id}/register`);
      setRegistered(prev => { const n = new Set(prev); n.delete(id); return n; });
    } finally {
      setRegistering(null);
    }
  };

  return (
    <div className="page-wrap enter-up">
      <header>
        <MatchLine label="Competitions / tournaments" />
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">The Tournaments.</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#989ba5]">
              Head-to-head elimination events. Register early, seed high, and fight your way to the top.
            </p>
          </div>
        </div>
      </header>

      {/* Tab filters */}
      <div className="mt-7 flex gap-2 overflow-x-auto pb-1">
        {(["all", "registration", "active"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`topic-button whitespace-nowrap ${tab === t ? "is-selected" : ""}`}
          >
            {t === "all" ? "All" : t === "registration" ? "Open Registration" : "Live Now"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center text-[#848792]">Loading tournaments…</div>
      ) : tournaments.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Trophy className="h-10 w-10 text-[#333540]" />
          <p className="text-[#848792]">No tournaments found. Check back soon!</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((t) => {
            const { label, tone } = STATUS_LABELS[t.status] || { label: t.status, tone: "neutral" };
            const isReg = registered.has(t.id);
            const canRegister = ["upcoming", "registration"].includes(t.status);
            return (
              <div key={t.id} className="panel flex flex-col overflow-hidden">
                <div className="p-5 sm:p-6 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <Pill tone={tone}>{t.status === "active" ? <><span className="live-dot" /> {label}</> : label}</Pill>
                    <span className="font-mono text-[10px] text-[#747783] uppercase">{t.format.replace("_", " ")}</span>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold tracking-[-.04em]">{t.name}</h2>
                  {t.description && (
                    <p className="mt-2 text-xs leading-5 text-[#909399]">{t.description}</p>
                  )}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#848792]">
                      <Users className="h-3.5 w-3.5" />
                      <span>{t.participantCount ?? 0} / {t.maxParticipants} participants</span>
                    </div>
                    {t.startTime && (
                      <div className="flex items-center gap-2 text-xs text-[#848792]">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{new Date(t.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    )}
                    {t.prizeDescription && (
                      <div className="flex items-center gap-2 text-xs text-[#edc286]">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>{t.prizeDescription}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-white/[.08] p-4 flex items-center justify-between gap-3">
                  <Link href={`/tournaments/${t.id}`} className="flex items-center gap-1 text-xs text-[#aeb1ba] hover:text-white">
                    View bracket <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  {canRegister && (
                    <button
                      disabled={registering === t.id}
                      onClick={() => isReg ? withdraw(t.id) : register(t.id)}
                      className={isReg
                        ? "px-3 py-1.5 text-xs font-medium rounded border border-white/15 text-[#e48b87] hover:bg-red-950/20 transition-colors"
                        : "primary-button px-3 py-1.5 text-xs"
                      }
                    >
                      {registering === t.id ? "…" : isReg ? "Withdraw" : "Register"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
