/**
 * Style system: Tournament Console — matchmaking reads as a live pre-match control room,
 * with smoothly escalating queue telemetry that resolves into a decisive opponent reveal.
 */
import {
  Avatar,
  MatchLine,
  Pill,
  RankBadge,
  Streak,
} from "@/components/ArenaPrimitives";
import {
  Check,
  Crosshair,
  KeyRound,
  RotateCcw,
  Swords,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useMatchSocket } from "@/hooks/useMatchSocket";

const battleTypes = [
  {
    id: "blitz",
    name: "Blitz",
    time: "05:00",
    detail: "Fast reads. One decisive pass.",
  },
  {
    id: "standard",
    name: "Standard",
    time: "10:00",
    detail: "The balanced arena format.",
  },
  {
    id: "deep",
    name: "Deep Battle",
    time: "20:00",
    detail: "More room for difficult paths.",
  },
];

const topics = [
  "Random",
  "Arrays",
  "Strings",
  "Linked Lists",
  "Trees",
  "Graphs",
  "Dynamic Programming",
  "Greedy",
  "Searching",
  "Sorting",
];

const opponentsData = [
  {
    name: "Rohan Malik",
    handle: "rohanbits",
    initials: "RM",
    rating: 1856,
    rank: "Platinum" as any,
    streak: 3,
  },
  {
    name: "Maya Chen",
    handle: "mchen",
    initials: "MC",
    rating: 1811,
    rank: "Platinum" as any,
    streak: 5,
  },
];

type MatchState = "setup" | "searching" | "found";
const queueStages = [
  "Calibrating your rating band",
  "Scanning active battle pools",
  "Finalizing a nearby opponent",
];

export default function Matchmaking() {
  const { player, loading, error } = usePlayerData();
  const { socket, connected } = useMatchSocket();
  const [battleType, setBattleType] = useState("standard");
  const [topic, setTopic] = useState("Random");
  const [difficulty, setDifficulty] = useState("Adaptive");
  const [state, setState] = useState<MatchState>("setup");
  const [activeOpponent, setActiveOpponent] = useState(0);
  const [searchStep, setSearchStep] = useState(0);
  const [foundMatch, setFoundMatch] = useState<any>(null);

  useEffect(() => {
    if (!socket) return;
    const handleMatchFound = (payload: any) => {
      setFoundMatch(payload);
      setState("found");
    };
    const handleQueueError = () => setState("setup");
    socket.on("match_found", handleMatchFound);
    socket.on("error_event", handleQueueError);
    return () => {
      socket.off("match_found", handleMatchFound);
      socket.off("error_event", handleQueueError);
    };
  }, [socket]);

  useEffect(() => {
    if (state !== "searching") return;
    const signalTimer = window.setInterval(
      () => setSearchStep(current => (current + 1) % queueStages.length),
      920
    );
    return () => window.clearInterval(signalTimer);
  }, [state]);

  const opponent = foundMatch?.opponent || opponentsData[activeOpponent];
  const startSearch = () => {
    if (!socket || !connected) return;
    setSearchStep(0);
    setState("searching");
    socket.emit("join_queue", {
      mode: battleType === "standard" ? "ranked" : "casual",
    });
  };
  const cancelSearch = () => {
    socket?.emit("leave_queue", {});
    setState("setup");
    setSearchStep(0);
  };

  if (loading)
    return (
      <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">
        Loading matchmaking...
      </div>
    );
  if (error || !player)
    return (
      <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">
        Error loading player data.
      </div>
    );

  return (
    <div className="page-wrap enter-up">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 sm:mb-8">
          <MatchLine label="Battle / Matchmaking" />
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">
                Enter the queue.
              </h1>
              <p className="mt-2 max-w-[560px] text-sm leading-6 text-[#989ba5]">
                Set the terms. We’ll place you into a fair, focused match.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/rooms/create"
                  className="secondary-button min-h-9 px-3 text-xs"
                >
                  <Swords className="h-3.5 w-3.5" />
                  Host a private room
                </Link>
                <Link
                  href="/join"
                  className="secondary-button min-h-9 px-3 text-xs"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Join with a code
                </Link>
              </div>
            </div>
            <Pill tone="red">
              <span className="live-dot" /> 1,284 active players
            </Pill>
          </div>
        </header>
        {state === "setup" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="panel p-5 sm:p-7">
              <div>
                <p className="section-kicker">01 / Battle type</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {battleTypes.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setBattleType(item.id)}
                      className={`choice-card ${battleType === item.id ? "is-selected" : ""}`}
                    >
                      <span className="font-display text-base font-bold">
                        {item.name}
                      </span>
                      <span className="mt-2 block font-mono text-xs text-[#c8c9ce]">
                        {item.time}
                      </span>
                      <span className="mt-3 block text-[11px] leading-4 text-[#858893]">
                        {item.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <p className="section-kicker">02 / Topic</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {topics.map(value => (
                    <button
                      onClick={() => setTopic(value)}
                      key={value}
                      className={`topic-button ${topic === value ? "is-selected" : ""}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <p className="section-kicker">03 / Difficulty</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["Easy", "Medium", "Hard", "Adaptive"].map(value => (
                    <button
                      key={value}
                      onClick={() => setDifficulty(value)}
                      className={`choice-card py-3 ${difficulty === value ? "is-selected" : ""}`}
                    >
                      <span className="font-mono text-xs uppercase tracking-[.07em]">
                        {value}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={startSearch}
                disabled={!connected}
                className="primary-button mt-8 w-full sm:w-auto"
              >
                <Crosshair className="h-4 w-4" />
                {connected ? "Find my match" : "Connecting..."}
              </button>
            </section>
            <aside className="control-panel p-5 sm:p-6">
              <p className="section-kicker">Your entry card</p>
              <div className="mt-5 flex items-center gap-3">
                <Avatar initials={player.initials} size="lg" />
                <div>
                  <p className="font-display text-xl font-bold tracking-[-.05em]">
                    {player.handle}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <RankBadge rank={player.rank} />
                    <span className="font-mono text-xs text-[#c7c8ce]">
                      {player.rating}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-7 border-y border-white/[.08] py-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#898c96]">Queue range</span>
                  <span className="font-mono text-[#dddde0]">1,767—1,917</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-[#898c96]">Expected wait</span>
                  <span className="font-mono text-[#b5df73]">00:24</span>
                </div>
              </div>
              <div className="mt-5 rounded-sm border border-[#b5df73]/15 bg-[#b5df73]/[.06] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[.12em] text-[#cde7a5]">
                  Fair pairing
                </p>
                <p className="mt-2 text-xs leading-5 text-[#acb99a]">
                  Matchmaking considers rating, activity, and selected topic.
                </p>
              </div>
            </aside>
          </div>
        )}
        {state === "searching" && (
          <section
            className="relative overflow-hidden border border-white/10 bg-cover bg-center p-6 sm:p-10"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(20,21,26,.96), rgba(20,21,26,.67)), url('/manus-storage/codeclash-matchmaking_394acbc8.jpg')",
            }}
          >
            <div className="scan-line absolute bottom-0 left-0 h-0.5 w-[12%] bg-[#f04432] shadow-[0_0_20px_#f04432]" />
            <div className="relative z-10 mx-auto max-w-xl text-center">
              <Pill tone="red">
                <span className="live-dot" /> Queue scan / 0{searchStep + 1}
              </Pill>
              <div className="mx-auto mt-11">
                <div className="queue-pulse mx-auto">
                  <span className="queue-rings" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="queue-orbit" />
                  <span className="queue-scan" />
                  <div className="queue-pulse-core">
                    <Crosshair className="h-7 w-7" />
                  </div>
                </div>
              </div>
              <h2 className="mt-11 font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">
                Searching for
                <br />
                your opponent.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[#b0b3bd]">
                Holding your place around{" "}
                <strong className="font-mono text-[#f0f0f0]">
                  {player.rating}
                </strong>
                . A suitable challenger is in range.
              </p>
              <div className="queue-stage mt-6" aria-live="polite">
                <span className="queue-stage-dot" />
                <span>{queueStages[searchStep]}</span>
                <span className="queue-stage-track" aria-hidden="true">
                  {queueStages.map((_, index) => (
                    <span
                      key={index}
                      className={index === searchStep ? "is-active" : ""}
                    />
                  ))}
                </span>
              </div>
              <div className="queue-signal-grid mt-8">
                <div>
                  <span className="section-kicker">Range</span>
                  <p className="mt-1 font-mono text-sm">±75</p>
                </div>
                <div>
                  <span className="section-kicker">Queue</span>
                  <p className="mt-1 font-mono text-sm">1,284</p>
                </div>
                <div>
                  <span className="section-kicker">Mode</span>
                  <p className="mt-1 font-mono text-sm">10:00</p>
                </div>
              </div>
              <button onClick={cancelSearch} className="secondary-button mt-7">
                <RotateCcw className="h-4 w-4" />
                Cancel search
              </button>
            </div>
          </section>
        )}
        {state === "found" && (
          <section className="relative overflow-hidden border border-[#f04432]/40 bg-[#18191f] p-5 shadow-[0_20px_70px_rgba(240,68,50,.08)] sm:p-10">
            <div
              className="absolute inset-0 opacity-[.24]"
              style={{
                backgroundImage:
                  "linear-gradient(115deg, transparent 0%, transparent 47%, rgba(240,68,50,.55) 47.2%, transparent 47.5%), url('/manus-storage/codeclash-matchmaking_394acbc8.jpg')",
                backgroundSize: "cover",
              }}
            />
            <div className="relative z-10 mx-auto max-w-3xl">
              <div className="text-center">
                <Pill tone="lime">
                  <Check className="h-3 w-3" /> Pair confirmed
                </Pill>
                <h2 className="mt-5 font-display text-4xl font-bold tracking-[-.07em] sm:text-5xl">
                  Opponent found.
                </h2>
                <p className="mt-2 font-mono text-xs uppercase tracking-[.14em] text-[#a9abb3]">
                  STANDARD // {topic.toUpperCase()} //{" "}
                  {difficulty.toUpperCase()}
                </p>
              </div>
              <div className="mt-8 grid items-center gap-5 sm:grid-cols-[1fr_auto_1fr]">
                <div className="control-panel p-5">
                  <div className="flex items-center gap-3">
                    <Avatar initials={player.initials} tone="red" size="lg" />
                    <div>
                      <p className="font-display text-lg font-bold">
                        {player.handle}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-[#878a95]">
                        {player.rating} RATING
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-between">
                    <RankBadge rank={player.rank} />
                    <Streak value={player.streak} compact />
                  </div>
                </div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#f04432]/40 bg-[#f04432] font-display text-xl font-bold italic">
                  VS
                </div>
                <div className="control-panel p-5">
                  <div className="flex items-center gap-3">
                    <Avatar
                      initials={opponent.initials}
                      tone="blue"
                      size="lg"
                    />
                    <div>
                      <p className="font-display text-lg font-bold">
                        {opponent.handle}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-[#878a95]">
                        {opponent.rating} RATING
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-between">
                    <RankBadge rank={opponent.rank} />
                    <Streak value={opponent.streak} compact />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href={`/battle/${foundMatch?.matchId || ""}`} className="primary-button">
                  <Swords className="h-4 w-4" />
                  Enter battle
                </Link>
                <button
                  onClick={() => setState("searching")}
                  className="secondary-button"
                >
                  <Users className="h-4 w-4" />
                  Find another
                </button>
              </div>
              <p className="mt-5 text-center text-xs text-[#858893]">
                Both players have 30 seconds to enter. Good luck.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
