/**
 * Style system: Tournament Console — the join flow treats guest access as a trustworthy,
 * lightweight invitation with precise room context and no reduced visual experience.
 */
import { MatchLine, Pill } from "@/components/ArenaPrimitives";
import { ArrowRight, CheckCircle2, KeyRound, Link2, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";

const previewRoom = { code: "CLO-7M2K", host: "niacodes", mode: "Arena", capacity: "2 / 4", topic: "Random", tempo: "10:00" };

export default function RoomJoin() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/join/:code");
  const [code, setCode] = useState(params?.code ?? "");
  const [guest, setGuest] = useState(true);
  const [alias, setAlias] = useState("Guest Solver");
  const activeCode = (code || previewRoom.code).trim().toUpperCase();
  const join = (event: FormEvent) => {
    event.preventDefault();
    setLocation(`/room/${activeCode}/wait?guest=${guest ? "1" : "0"}&alias=${encodeURIComponent(alias || "Guest Solver")}`);
  };

  return <div className="page-wrap enter-up mx-auto max-w-5xl">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel p-5 sm:p-8">
        <MatchLine label="Rooms / Join" />
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">Enter the room.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#989ba5]">Use a host’s room code or shared link. Guests can take a seat without creating an account.</p></div>
          <Pill tone="lime"><CheckCircle2 className="h-3 w-3" /> Guest entry enabled</Pill>
        </div>
        <form onSubmit={join} className="mt-8">
          <label className="block"><span className="section-kicker">Room code</span><div className="mt-3 flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-3 border border-white/12 bg-black/20 px-3 transition-colors focus-within:border-[#b5df73]/60"><KeyRound className="h-4 w-4 flex-none text-[#8b8e98]" /><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={previewRoom.code} className="w-full bg-transparent py-3.5 font-mono text-sm tracking-[.12em] text-white outline-none placeholder:text-[#666974]" /></div><button type="submit" className="primary-button px-4" aria-label="Continue with room code"><ArrowRight className="h-4 w-4" /></button></div></label>
          <div className="mt-7 border-y border-white/[.08] py-6"><p className="section-kicker">Entry type</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setGuest(true)} className={`choice-card p-3 ${guest ? "is-selected" : ""}`}><UserRound className={`h-4 w-4 ${guest ? "text-[#b5df73]" : "text-[#7c808a]"}`} /><span className="mt-3 block text-sm font-semibold">Join as guest</span><span className="mt-1 block text-[11px] leading-4 text-[#878a94]">No account. Your host still controls access.</span></button><button type="button" onClick={() => setGuest(false)} className={`choice-card p-3 ${!guest ? "is-selected" : ""}`}><ShieldCheck className={`h-4 w-4 ${!guest ? "text-[#b5df73]" : "text-[#7c808a]"}`} /><span className="mt-3 block text-sm font-semibold">Account player</span><span className="mt-1 block text-[11px] leading-4 text-[#878a94]">Bring your rating and player profile into the room.</span></button></div>{guest && <label className="mt-5 block text-xs font-medium text-[#d9dadd]">Guest display name<input value={alias} onChange={(event) => setAlias(event.target.value)} className="mt-2 w-full border border-white/12 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-[#b5df73]/60" /></label>}</div>
          <div className="mt-5 flex items-start gap-3 border-l-2 border-[#b5df73]/50 bg-[#b5df73]/[.045] px-4 py-3"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#b5df73]" /><p className="text-xs leading-5 text-[#b9c5a3]">You’ll enter the waiting room first. The host starts the match when the room is ready.</p></div>
          <button type="submit" className="primary-button mt-7"><Link2 className="h-4 w-4" />Join room</button>
        </form>
      </section>
      <aside className="space-y-5">
        <section className="control-panel room-join-preview p-5 sm:p-6"><div className="flex items-center justify-between"><p className="section-kicker">Invitation preview</p><Pill tone="neutral">Live</Pill></div><div className="room-code-module mt-5"><div className="flex items-center justify-between"><span className="room-code-value">{activeCode || previewRoom.code}</span><span className="font-mono text-[10px] uppercase tracking-[.11em] text-[#c6aa77]">{previewRoom.mode}</span></div><p className="mt-3 text-xs text-[#b8ae9f]">Hosted by <span className="text-[#ece8e1]">{previewRoom.host}</span></p></div><dl className="room-entry-data mt-5"><div><dt>Roster</dt><dd>{previewRoom.capacity} seats</dd></div><div><dt>Challenge</dt><dd>{previewRoom.topic}</dd></div><div><dt>Tempo</dt><dd>{previewRoom.tempo}</dd></div><div><dt>Guest route</dt><dd className="text-[#b5df73]">Waiting room</dd></div></dl></section>
        <section className="panel-soft p-5 sm:p-6"><Pill tone="lime">Guest friendly</Pill><h2 className="mt-5 font-display text-2xl font-bold tracking-[-.055em]">No account? No problem.</h2><p className="mt-3 text-xs leading-6 text-[#999ca6]">Guests get a display name and wait for the host’s match start. Room rules still apply, and the host may remove access at any time.</p><div className="mt-7 border-t border-white/[.08] pt-5"><span className="section-kicker">Need a room?</span><Link href="/rooms/create" className="mt-3 flex items-center justify-between text-sm font-semibold hover:text-[#b5df73]">Host your own <ArrowRight className="h-4 w-4" /></Link></div></section>
      </aside>
    </div>
  </div>;
}
