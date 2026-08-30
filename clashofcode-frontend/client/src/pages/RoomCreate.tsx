/**
 * Style system: Tournament Console — room creation remains an operational pre-match desk,
 * now amplified with compact control panels, tactile room-code modules, and participant-slot signals.
 */
import { MatchLine, Pill } from "@/components/ArenaPrimitives";
import { Check, Copy, Crown, Link2, Plus, Share2, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useRoomData } from "@/hooks/useRoomData";

const battleTypes = [
  { id: "blitz", name: "Blitz", time: "05:00", description: "Fast-paced combat. Ideal for syntax speed and simple algorithmic recall." },
  { id: "standard", name: "Standard", time: "10:00", description: "The core arena format. Balances execution speed with thoughtful optimization." },
  { id: "deep", name: "Deep Battle", time: "20:00", description: "Complex problem space. Requires architectural thinking and multiple passes." },
];

const topics = [
  "Random",
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Graphs",
  "Dynamic Programming",
];

const roomCode = "CLO-7M2K";
const guestLink = `${window.location.origin}/join/${roomCode}`;

export default function RoomCreate() {
  const [mode, setMode] = useState<"solo" | "arena">("arena");
  const [capacity, setCapacity] = useState("4");
  const [battleType, setBattleType] = useState("standard");
  const [topic, setTopic] = useState("Random");
  const [roomName, setRoomName] = useState("Saturday algorithm session");
  const [ruleNote, setRuleNote] = useState("Explain your approach after each round.");
  const [rules, setRules] = useState(["Guests can join", "Reveal tests after submit"]);
  const [created, setCreated] = useState(false);
  const toggleRule = (rule: string) => setRules((current) => current.includes(rule) ? current.filter((item) => item !== rule) : [...current, rule]);
  const copy = (value: string, label: string) => { void navigator.clipboard?.writeText(value); toast.success(`${label} copied`); };
  const shareInvitation = async () => { if (navigator.share) { await navigator.share({ title: "Join my ClashOfCode room", text: `Join my coding room with code ${roomCode}.`, url: guestLink }); toast.success("Share sheet opened"); } else copy(guestLink, "Guest link"); };
  const lobbyHref = `/room/${roomCode}?mode=${mode}&max=${capacity}`;
  const slots = mode === "solo" ? 1 : Number(capacity);

  if (created) return <div className="page-wrap enter-up mx-auto max-w-5xl"><MatchLine label="Rooms / Provisioned" /><section className="control-panel relative mt-6 overflow-hidden p-6 sm:p-10"><div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_50%,rgba(181,223,115,.13),transparent_60%)]" /><div className="relative z-10 max-w-3xl"><Pill tone="lime"><Check className="h-3.5 w-3.5" /> Room ready</Pill><h1 className="mt-5 font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">Your room is live.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#aeb2ba]">You are the host. Invite players with a short code or let guests enter directly through the shared link—no account needed.</p><div className="mt-7 flex flex-wrap items-center gap-3"><div className="room-slot is-host">YOU</div>{Array.from({ length: Math.max(slots - 1, 0) }, (_, index) => <div className="room-slot is-open" key={index}>+</div>)}<span className="ml-1 font-mono text-[10px] uppercase tracking-[.12em] text-[#8c909b]">{mode} / {slots} player capacity</span></div><div className="invite-room-grid mt-9"><section className="invite-code-hero"><span className="section-kicker">Room code / instant entry</span><button onClick={() => copy(roomCode, "Room code")} className="invite-code-copy"><span className="invite-code-value">{roomCode}</span><span className="invite-copy-hint"><Copy className="h-4 w-4" />Copy code</span></button><p>Send this code to signed-in players, or share the guest link for no-account entry.</p></section><section className="invite-share-panel"><span className="section-kicker">Guest invitation</span><div className="invite-link-value"><Link2 className="h-4 w-4" /><span>{guestLink}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={() => shareInvitation()} className="primary-button"><Share2 className="h-4 w-4" />Share invitation</button><button onClick={() => copy(guestLink, "Guest link")} className="secondary-button"><Copy className="h-4 w-4" />Copy link</button></div></section></div><div className="mt-6 flex flex-wrap gap-3"><Link href={lobbyHref} className="primary-button"><Crown className="h-4 w-4" />Open admin lobby</Link><Link href="/join" className="secondary-button"><Users className="h-4 w-4" />Preview guest join</Link></div></div></section></div>;

  return <div className="page-wrap enter-up mx-auto max-w-6xl"><header><MatchLine label="Rooms / Create" /><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">Stage your own arena.</h1><p className="mt-2 max-w-[610px] text-sm leading-6 text-[#989ba5]">Set the format, invite your circle, and take full control of how the room runs.</p></div><Link href="/join" className="secondary-button"><Link2 className="h-4 w-4" />Join a room</Link></div></header><div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]"><section className="panel p-5 sm:p-7"><div><p className="section-kicker">01 / Room identity</p><label className="mt-4 block text-xs font-medium text-[#d9dadd]">Room name<input value={roomName} onChange={(event) => setRoomName(event.target.value)} className="console-input mt-2" /></label></div><div className="mt-8"><p className="section-kicker">02 / Match mode</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={() => setMode("solo")} className={`choice-card ${mode === "solo" ? "is-selected" : ""}`}><span className="font-display text-lg font-bold">Solo room</span><span className="mt-2 block text-xs leading-5 text-[#91949e]">Private practice with your own rule set and launch control.</span></button><button onClick={() => setMode("arena")} className={`choice-card ${mode === "arena" ? "is-selected" : ""}`}><span className="font-display text-lg font-bold">Arena room</span><span className="mt-2 block text-xs leading-5 text-[#91949e]">One to many players join a shared custom battle.</span></button></div></div><div className="mt-8"><p className="section-kicker">03 / Players & format</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-[#d9dadd]">Maximum players<select value={capacity} disabled={mode === "solo"} onChange={(event) => setCapacity(event.target.value)} className="console-input mt-2 disabled:opacity-50">{["2", "4", "8", "12"].map((value) => <option key={value} value={value}>{value} players</option>)}</select></label><div><span className="text-xs font-medium text-[#d9dadd]">Battle tempo</span><div className="mt-2 grid grid-cols-3 gap-2">{battleTypes.map((item) => <button key={item.id} onClick={() => setBattleType(item.id)} className={`choice-card p-3 ${battleType === item.id ? "is-selected" : ""}`}><span className="block font-mono text-[10px] text-[#c6c8cf]">{item.time}</span><span className="mt-1 block text-[11px] font-medium">{item.name}</span></button>)}</div></div></div></div><div className="mt-8"><p className="section-kicker">04 / Challenge topic</p><div className="mt-4 flex flex-wrap gap-2">{topics.map((value) => <button key={value} onClick={() => setTopic(value)} className={`topic-button ${topic === value ? "is-selected" : ""}`}>{value}</button>)}</div></div><div className="mt-8"><p className="section-kicker">05 / Custom rules</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{["Guests can join", "Require host approval", "Reveal tests after submit", "Hide opponent progress"].map((rule) => <button key={rule} onClick={() => toggleRule(rule)} className={`choice-card flex items-center gap-3 p-3 ${rules.includes(rule) ? "is-selected" : ""}`}><span className={`flex h-4 w-4 items-center justify-center border ${rules.includes(rule) ? "border-[#f04432] bg-[#f04432]" : "border-white/25"}`}>{rules.includes(rule) && <Check className="h-3 w-3" />}</span><span className="text-xs font-medium">{rule}</span></button>)}</div><label className="mt-3 block text-xs font-medium text-[#d9dadd]">Host note<textarea value={ruleNote} onChange={(event) => setRuleNote(event.target.value)} className="console-input mt-2 min-h-24 resize-y leading-6" /></label></div><button onClick={() => setCreated(true)} className="primary-button mt-8"><Plus className="h-4 w-4" />Create room</button></section><aside className="control-panel h-fit p-5 sm:p-6"><p className="section-kicker">Your host brief</p><div className="mt-5 border-b border-white/[.08] pb-5"><p className="font-display text-xl font-bold tracking-[-.05em]">{roomName || "Untitled room"}</p><p className="mt-2 font-mono text-[10px] uppercase tracking-[.13em] text-[#8b8e98]">{mode} / {mode === "solo" ? "1 player" : `${capacity} player cap`}</p></div><div className="host-brief-data mt-5"><div><span>Topic</span><strong>{topic}</strong></div><div><span>Tempo</span><strong>{battleTypes.find((item) => item.id === battleType)?.time}</strong></div><div><span>Access</span><strong className={rules.includes("Guests can join") ? "text-[#b5df73]" : ""}>{rules.includes("Guests can join") ? "Guest enabled" : "Account only"}</strong></div></div><div className="border border-[#f04432]/20 bg-[#f04432]/[.06] p-4"><div className="flex items-center gap-2 text-[#ff9589]"><ShieldCheck className="h-4 w-4" /><span className="font-mono text-[10px] uppercase tracking-[.12em]">Host authority</span></div><p className="mt-3 text-xs leading-5 text-[#b9a6a5]">You will be able to edit rules, remove players, admit guests, and start the match from the lobby.</p></div></aside></div></div>;
}
