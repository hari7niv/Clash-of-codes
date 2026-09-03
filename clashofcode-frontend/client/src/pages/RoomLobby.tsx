/**
 * Style system: Tournament Console — the lobby gives host authority a broadcast-ready presence,
 * using room slots, number blocks, and code modules while keeping player roles and start control explicit.
 */
import { Avatar, MatchLine, Pill, RankBadge } from "@/components/ArenaPrimitives";
import { Check, Copy, Crown, Link2, LockKeyhole, Play, Plus, Settings2, UserMinus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useRoomData } from "@/hooks/useRoomData";

type Participant = { id: string; initials: string; handle: string; role: "Host" | "Player" | "Guest"; rating: string; tone: "red" | "blue" | "stone" };

export default function RoomLobby() {
  const [location, setLocation] = useLocation();
  const search = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);
  const code = location.match(/\/room\/([^?]+)/)?.[1]?.toUpperCase() ?? "";
  const { room, player, loading, error } = useRoomData(code);
  
  const mode = search.get("mode") ?? "arena";
  const max = mode === "solo" ? "1" : search.get("max") ?? "4";
  const guestName = search.get("guest") === "1" ? (search.get("alias") ?? "Guest Solver") : null;
  const [participants, setParticipants] = useState<Participant[]>(() => [
    { 
      id: "host", 
      initials: player?.initials || "ME", 
      handle: player?.handle || "Loading...", 
      role: "Host", 
      rating: String(player?.rating || "1500"), 
      tone: "red" 
    },
    ...(guestName ? [{ 
      id: "guest", 
      initials: guestName.slice(0, 2).toUpperCase(), 
      handle: guestName, 
      role: "Guest" as const, 
      rating: "Guest", 
      tone: "stone" as const 
    }] : [])
  ]);
  const [allowGuests, setAllowGuests] = useState(true);
  const [approval, setApproval] = useState(false);
  const [hiddenProgress, setHiddenProgress] = useState(true);
  const guestLink = `${window.location.origin}/join/${code}`;
  const copy = (value: string, label: string) => { void navigator.clipboard?.writeText(value); toast.success(`${label} copied`); };
  const addPreviewGuest = () => setParticipants((current) => current.length >= Number(max) ? current : [...current, { id: `guest-${current.length}`, initials: "GS", handle: "guest.solver", role: "Guest", rating: "Guest", tone: "stone" }]);
  const remove = (id: string) => setParticipants((current) => current.filter((member) => member.id !== id));
  const controls = [{ label: "Allow guest invites", state: allowGuests, setState: setAllowGuests }, { label: "Require host approval", state: approval, setState: setApproval }, { label: "Hide opponent progress", state: hiddenProgress, setState: setHiddenProgress }];
  const playerCap = Number(max);
  return <div className="page-wrap enter-up mx-auto max-w-6xl"><header><MatchLine label={`Rooms / ${code} / Host control`} /><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Pill tone="red"><span className="live-dot" /> Room live</Pill><Pill tone="lime"><Crown className="h-3 w-3" /> You are admin</Pill></div><h1 className="mt-4 font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">The room is yours to run.</h1><p className="mt-2 text-sm leading-6 text-[#989ba5]">{mode.toUpperCase()} ROOM · Standard / Random</p></div><div className="flex items-end gap-3"><div className="broadcast-number"><span>Roster</span><strong>{participants.length}/{max}</strong></div><div className="broadcast-number hidden sm:inline-flex"><span>Tempo</span><strong>10:00</strong></div><button onClick={() => setLocation("/battle")} className="primary-button"><Play className="h-4 w-4" />Start match</button></div></div></header><div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]"><div className="space-y-5"><section className="panel p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-kicker">Participants</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-.055em]">Room roster</h2></div><button onClick={addPreviewGuest} disabled={participants.length >= playerCap} className="secondary-button min-h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Preview guest join</button></div><div className="mt-5 flex flex-wrap gap-3 border-y border-white/[.08] py-4">{Array.from({ length: playerCap }, (_, index) => { const member = participants[index]; return <div key={member?.id ?? index} className={`room-slot ${index === 0 ? "is-host" : member ? "" : "is-open"}`} title={member?.handle ?? "Open player slot"}>{member ? member.initials : "+"}</div>; })}<span className="self-center font-mono text-[10px] uppercase tracking-[.12em] text-[#868994]">{participants.length === playerCap ? "Roster full" : `${playerCap - participants.length} slot${playerCap - participants.length === 1 ? "" : "s"} open`}</span></div><div className="mt-5 divide-y divide-white/[.08]">{participants.map((member) => <div key={member.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"><Avatar initials={member.initials} tone={member.tone} size="md" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#e9e9eb]">{member.handle}</span>{member.role === "Host" ? <Pill tone="red"><Crown className="h-3 w-3" />Host admin</Pill> : <Pill tone={member.role === "Guest" ? "blue" : "neutral"}>{member.role}</Pill>}</div><div className="mt-1 flex items-center gap-2"><span className="font-mono text-[10px] text-[#858894]">{member.rating === "Guest" ? "NO ACCOUNT" : `${member.rating} RATING`}</span>{member.role !== "Guest" && <RankBadge rank="Platinum" />}</div></div>{member.role !== "Host" && <button onClick={() => remove(member.id)} className="icon-button h-8 w-8" aria-label={`Remove ${member.handle}`}><UserMinus className="h-4 w-4" /></button>}</div>)}</div></section><section className="panel p-5 sm:p-7"><p className="section-kicker">Configured match</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="border border-white/[.09] bg-white/[.025] p-4"><span className="section-kicker">Mode</span><p className="mt-2 font-display text-lg font-bold capitalize">{mode}</p></div><div className="border border-white/[.09] bg-white/[.025] p-4"><span className="section-kicker">Tempo</span><p className="mt-2 font-display text-lg font-bold">10:00</p></div><div className="border border-white/[.09] bg-white/[.025] p-4"><span className="section-kicker">Topic</span><p className="mt-2 font-display text-lg font-bold">Random</p></div></div><div className="mt-4 border-l-2 border-[#f04432] bg-[#f04432]/[.055] p-4"><p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#ff9589]">Host rule</p><p className="mt-2 text-sm text-[#d5c0bd]">Explain your approach after each round. Tests reveal after submit.</p></div></section></div><aside className="space-y-5"><section className="control-panel p-5"><p className="section-kicker">Invite access</p><button onClick={() => copy(code, "Room code")} className="room-code-module mt-4 w-full"><span className="section-kicker">Room code</span><span className="room-code-value">{code}</span><Copy className="absolute right-4 top-4 h-4 w-4 text-[#c39b5e]" /></button><button onClick={() => copy(guestLink, "Guest link")} className="mt-3 flex w-full items-center justify-between gap-3 border border-white/10 bg-white/[.035] p-3 text-left transition hover:border-white/20 hover:bg-white/[.055]"><span className="min-w-0"><span className="section-kicker">Share link / no account</span><span className="mt-1 block truncate text-xs text-[#d2d3d8]">{guestLink}</span></span><Link2 className="h-4 w-4 flex-none text-[#979aa4]" /></button></section><section className="panel p-5"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-[#ff9589]" /><p className="section-kicker">Admin rules</p></div><div className="mt-4 space-y-3">{controls.map((control) => <button key={control.label} onClick={() => control.setState(!control.state)} className="flex w-full items-center justify-between text-left"><span className="text-xs text-[#d9dade]">{control.label}</span><span className={`relative h-5 w-9 border transition ${control.state ? "border-[#f04432] bg-[#f04432]" : "border-white/20 bg-white/[.05]"}`}><span className={`absolute top-0.5 h-3.5 w-3.5 bg-white transition-transform ${control.state ? "translate-x-4" : "translate-x-0.5"}`} /></span></button>)}</div><div className="mt-5 border-t border-white/[.08] pt-4"><div className="flex items-center gap-2 text-[#a5a8b1]"><LockKeyhole className="h-3.5 w-3.5" /><span className="text-xs">Only the host can change room rules.</span></div></div></section><section className="border border-[#b5df73]/20 bg-[#b5df73]/[.05] p-5"><div className="flex items-center gap-2 text-[#cde7a5]"><Users className="h-4 w-4" /><span className="font-mono text-[10px] uppercase tracking-[.12em]">Start condition</span></div><p className="mt-3 text-xs leading-5 text-[#b5c49b]">You can launch now. Players who have not joined will not enter the match.</p><button onClick={() => setLocation("/battle")} className="secondary-button mt-4 min-h-9 w-full border-[#b5df73]/30 text-[#d7efb0]"><Check className="h-3.5 w-3.5" />Launch as host</button></section></aside></div></div>;
}
