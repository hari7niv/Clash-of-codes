import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRoute, Link } from "wouter";
import { MatchLine, Pill, Avatar } from "@/components/ArenaPrimitives";
import { Trophy, Users, CalendarDays, ChevronLeft, Swords } from "lucide-react";

export default function TournamentDetails() {
  const [, params] = useRoute("/tournaments/:id");
  const id = params?.id;
  
  const [data, setData] = useState<{ tournament: any; participants: any[]; bracket: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/tournaments/${id}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">Loading bracket...</div>;
  if (!data || !data.tournament) return <div className="page-wrap enter-up p-8 flex flex-col items-center"><Trophy className="h-10 w-10 text-[#333540] mb-4" /><p className="text-[#848792]">Tournament not found.</p><Link href="/tournaments" className="mt-4 secondary-button"><ChevronLeft className="h-4 w-4" /> Back</Link></div>;

  const { tournament: t, participants, bracket } = data;

  // Group bracket matches by round
  const rounds = bracket.reduce((acc: any, match: any) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  const totalRounds = Object.keys(rounds).length;

  return (
    <div className="page-wrap enter-up">
      <header>
        <MatchLine label="Competitions / bracket" />
        <div className="mt-5 mb-8">
          <Link href="/tournaments" className="inline-flex items-center gap-1 text-xs text-[#848792] hover:text-white mb-4 transition-colors">
            <ChevronLeft className="h-3 w-3" /> Back to Tournaments
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Pill tone={t.status === "active" ? "red" : t.status === "upcoming" ? "blue" : "neutral"}>
                  {t.status === "active" ? <><span className="live-dot" /> LIVE</> : t.status.toUpperCase()}
                </Pill>
                <span className="font-mono text-[10px] text-[#747783] uppercase">{t.format.replace("_", " ")}</span>
              </div>
              <h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">{t.name}</h1>
              {t.description && <p className="mt-2 max-w-lg text-sm leading-6 text-[#989ba5]">{t.description}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/[.08] pt-4 text-xs text-[#aeb1ba]">
            <div className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {participants.length} / {t.maxParticipants} Participants</div>
            {t.startTime && <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {new Date(t.startTime).toLocaleDateString()}</div>}
            {t.prizeDescription && <div className="flex items-center gap-1.5 text-[#edc286]"><Trophy className="h-4 w-4" /> {t.prizeDescription}</div>}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Bracket View */}
        <section className="panel overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/[.08]">
            <h2 className="font-display text-lg font-bold tracking-[-.04em]">Tournament Bracket</h2>
          </div>
          <div className="p-6 overflow-x-auto min-h-[400px]">
            {totalRounds === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-[#848792]">
                <Swords className="h-8 w-8 mb-3 opacity-50" />
                <p>Bracket has not been generated yet.</p>
                {t.status === "upcoming" && <p className="text-[10px] mt-1">Check back when the tournament starts.</p>}
              </div>
            ) : (
              <div className="flex gap-12 min-w-max">
                {Object.keys(rounds).map((roundNum, roundIdx) => (
                  <div key={roundNum} className="flex flex-col gap-6 justify-around">
                    <div className="font-mono text-[10px] tracking-widest text-[#747783] text-center mb-4">ROUND {roundNum}</div>
                    {rounds[roundNum].map((match: any) => {
                      const p1 = participants.find(p => p.id === match.player1Id);
                      const p2 = participants.find(p => p.id === match.player2Id);
                      return (
                        <div key={match.id} className="w-48 bg-white/[.03] border border-white/[.08] rounded overflow-hidden flex flex-col">
                          <div className={`p-2 flex items-center justify-between border-b border-white/[.05] ${match.winnerId === match.player1Id ? 'bg-[#b5df73]/10' : ''}`}>
                            <span className={`text-xs truncate ${match.winnerId === match.player1Id ? 'text-white font-bold' : 'text-[#aeb1ba]'}`}>
                              {p1 ? p1.username : "TBD"}
                            </span>
                            {match.winnerId === match.player1Id && <Trophy className="h-3 w-3 text-[#b5df73]" />}
                          </div>
                          <div className={`p-2 flex items-center justify-between ${match.winnerId === match.player2Id ? 'bg-[#b5df73]/10' : ''}`}>
                            <span className={`text-xs truncate ${match.winnerId === match.player2Id ? 'text-white font-bold' : 'text-[#aeb1ba]'}`}>
                              {p2 ? p2.username : "TBD"}
                            </span>
                            {match.winnerId === match.player2Id && <Trophy className="h-3 w-3 text-[#b5df73]" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Participants List */}
        <section className="panel flex flex-col h-fit max-h-[600px]">
          <div className="p-5 border-b border-white/[.08] flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-[-.04em]">Participants</h2>
            <Pill tone="neutral">{participants.length}</Pill>
          </div>
          <div className="overflow-y-auto p-3 space-y-1">
            {participants.length === 0 ? (
              <p className="text-center text-xs text-[#848792] py-4">No participants yet</p>
            ) : (
              participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-white/[.03] transition-colors">
                  <Avatar initials={p.username.substring(0, 2).toUpperCase()} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{p.username}</div>
                    <div className="font-mono text-[10px] text-[#747783]">{p.rating} RATING</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
