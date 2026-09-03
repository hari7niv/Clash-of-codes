/**
 * Style system: Tournament Console — a compact professional coding arena with broadcast player readouts,
 * timer emphasis, code-runner micro-panels, and no distraction from the live contest.
 */
import { Avatar, MatchLine, Pill } from "@/components/ArenaPrimitives";
import {
  Check,
  ChevronDown,
  Code2,
  Play,
  Send,
  TerminalSquare,
  Timer,
  Wifi,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useBattleData } from "@/hooks/useBattleData";
import { useMatchSocket } from "@/hooks/useMatchSocket";

const lineNumbers = Array.from({ length: 15 }, (_, index) => index + 1);

const defaultCodeSnippet = `function minWindow(s: string, t: string): string {
  const need = new Map<string, number>();
  for (const char of t) need.set(char, (need.get(char) ?? 0) + 1);

  let left = 0;
  let matched = 0;
  let best = [0, Infinity];

  for (let right = 0; right < s.length; right++) {
    const char = s[right];
    // your implementation
  }

  return best[1] === Infinity ? "" : s.slice(best[0], best[1] + 1);
}`;

export default function Battle() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/battle/:matchId");
  
  // Validate matchId - if none provided, redirect to matchmaking
  const matchId = params?.matchId;
  
  // If no matchId provided, show a friendly message instead of error
  useEffect(() => {
    if (!matchId) {
      // The page will show a message asking to start a match
    }
  }, [matchId]);
  const [runState, setRunState] = useState<"idle" | "running" | "passed">(
    "idle"
  );
  const [code, setCode] = useState(defaultCodeSnippet);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState(
    "Run your code to see the test result."
  );
  const { socket, connected } = useMatchSocket();
  const { player, matchData, loading, error } = useBattleData(matchId || "no-match");

  // Redirect to matchmaking if no match exists and not loading
  useEffect(() => {
    if (!loading && !matchId) {
      // Show a prompt to start a match instead of auto-redirecting
    }
  }, [loading, matchId]);

  // Show message if no match ID is provided
  if (!matchId) {
    return (
      <div className="page-wrap enter-up p-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="font-display text-3xl font-bold tracking-[-.06em]">No Active Battle</h2>
          <p className="mt-3 text-sm text-[#989ba5] max-w-md">
            You don't have an active battle. Join matchmaking to find an opponent or create a room to play with friends.
          </p>
          <div className="mt-6 flex gap-3">
            <button 
              onClick={() => setLocation("/matchmaking")}
              className="primary-button"
            >
              Find Match
            </button>
            <button 
              onClick={() => setLocation("/rooms")}
              className="secondary-button"
            >
              Create Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!socket) return;
    const handleTimer = (payload: {
      roomId: string;
      timeRemainingMs: number;
    }) => {
      if (payload.roomId === matchId || payload.roomId === matchData?.roomId) {
        setTimeRemainingMs(payload.timeRemainingMs);
      }
    };
    const handleResult = (payload: {
      verdict: string;
      passedTests: number;
      totalTests: number;
    }) => {
      setRunState(payload.verdict === "accepted" ? "passed" : "idle");
      setSubmissionStatus(
        `${payload.passedTests} / ${payload.totalTests} tests: ${payload.verdict}`
      );
    };
    socket.on("timer_sync", handleTimer as any);
    socket.on("submission_result", handleResult as any);
    return () => {
      socket.off("timer_sync", handleTimer as any);
      socket.off("submission_result", handleResult as any);
    };
  }, [socket, matchId, matchData?.roomId]);

  if (loading)
    return (
      <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">
        Loading match...
      </div>
    );
  if (error || !player)
    return (
      <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">
        Error loading match.
      </div>
    );

  const opponent = matchData?.opponent || {
    handle: "rohanbits",
    initials: "RM",
    rating: 1856,
  };
  const roomId = matchData?.roomId || matchId;
  const formatTime = (milliseconds: number | null) => {
    if (milliseconds === null) return "--:--";
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const submitCode = (action: "run" | "submit" = "submit") => {
    if (!socket || !connected) return;
    setRunState("running");
    setSubmissionStatus(
      action === "run" ? "RUNNING SAMPLE TESTS..." : "SUBMITTED FOR JUDGING..."
    );
    socket.emit("submit_code", {
      roomId,
      language: "typescript",
      sourceCode: code,
      action,
    });
  };

  const problem = matchData?.problem || {
    title: "Minimum Window",
    topic: "STRING / SLIDING WINDOW",
    difficulty: "Medium",
    points: 25,
    statement:
      "Given strings s and t, return the minimum window substring of s such that every character in t is included. If there is no such window, return an empty string.",
    constraints: [
      "Time limit: 2000ms",
      "Memory limit: 256MB",
      "Target time complexity: O(n)",
    ],
    examples: [
      { input: "s = “ADOBECODEBANC”, t = “ABC”", output: "“BANC”" },
      { input: "s = “a”, t = “aa”", output: "“”" },
    ],
  };

  return (
    <div className="page-wrap enter-up">
      <header className="battle-header border border-white/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[.13em] text-[#f4877b]">
              Battle in progress
            </span>
          </div>
          <div className="hidden h-5 w-px bg-white/10 md:block" />
          <div className="battle-player">
            <Avatar initials={player.initials} size="sm" />
            <span className="font-mono text-[11px] text-[#d5d6da]">
              {player.handle}
            </span>
            <span className="font-mono text-[10px] text-[#8f929c]">
              {player.rating}
            </span>
          </div>
          <div className="battle-player">
            <Avatar initials={opponent.initials} tone="blue" size="sm" />
            <span className="font-mono text-[11px] text-[#d5d6da]">
              {opponent.handle}
            </span>
            <span className="font-mono text-[10px] text-[#8f929c]">
              {opponent.rating}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="battle-timer">
              <span className="section-kicker block">Time remaining</span>
              <span className="font-mono text-xl font-medium tracking-[-.05em] text-[#f5f2eb] sm:text-2xl">
                {formatTime(
                  timeRemainingMs ??
                    (matchData?.timeRemainingSeconds
                      ? matchData.timeRemainingSeconds * 1000
                      : null)
                )}
              </span>
            </div>
            <div className="hidden h-10 w-px bg-white/10 sm:block" />
            <div>
              <span className="section-kicker block">Match</span>
              <span className="font-mono text-xs text-[#d1d2d7]">
                {matchData?.matchCode || `#${matchId.substring(0, 4).toUpperCase()}`}
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(370px,.72fr)_minmax(520px,1.28fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-white/[.09] p-5 sm:p-6">
            <MatchLine label="Problem / 01" />
            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-[-.06em]">
                  {problem.title}
                </h1>
                <p className="mt-2 font-mono text-[11px] text-[#858893]">
                  {problem.topic.toUpperCase()}
                </p>
              </div>
              <div className="flex gap-2">
                <Pill tone="amber">{problem.difficulty}</Pill>
                <Pill>{problem.points || 25} pts</Pill>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-[#c4c6ce]">
              {problem.statement}
            </p>
          </div>
          <div className="space-y-6 p-5 sm:p-6">
            <div>
              <p className="section-kicker">Constraints</p>
              <ul className="mt-3 space-y-2 font-mono text-[11px] leading-5 text-[#aaaeb9]">
                {problem.constraints?.map((c: string, idx: number) => (
                  <li key={idx}>• {c}</li>
                )) || <li>• Standard execution constraints</li>}
              </ul>
            </div>
            <div>
              <p className="section-kicker">Examples</p>
              <div className="mt-3 space-y-3">
                {problem.examples?.map((ex: any, idx: number) => (
                  <div
                    key={idx}
                    className="border border-white/[.09] bg-[#111216] p-3 font-mono text-[11px] leading-5"
                  >
                    <span className="text-[#727580]">input</span>
                    <span className="ml-3 text-[#d7d8dc]">{ex.input}</span>
                    <br />
                    <span className="text-[#727580]">output</span>
                    <span className="ml-3 text-[#b5df73]">{ex.output}</span>
                  </div>
                )) || (
                  <div className="border border-white/[.09] bg-[#111216] p-3 font-mono text-[11px] leading-5">
                    <span className="text-[#727580]">No sample examples provided</span>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/[.08] pt-5">
              <div className="flex items-center justify-between">
                <p className="section-kicker">Opponent signal</p>
                <Pill tone="blue">
                  <Wifi className="h-3 w-3" /> Connected
                </Pill>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#979aa4]">
                Your opponent is working. No solution progress has been
                revealed.
              </p>
            </div>
          </div>
        </section>
        <section className="panel flex min-h-[670px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.09] bg-[#17181d] px-4 py-3">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 border border-white/10 bg-white/[.035] px-2.5 py-1.5 font-mono text-[10px] text-[#d5d6da]">
                TypeScript <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[10px] text-[#6f727c]">
                main.ts
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone="lime">
                <Check className="h-3 w-3" /> Saved
              </Pill>
              <button
                onClick={() => submitCode("run")}
                className="secondary-button min-h-8 px-3 text-[11px]"
              >
                <Play className="h-3.5 w-3.5" />
                {runState === "running" ? "Running..." : "Run"}
              </button>
              <button
                onClick={() => submitCode("submit")}
                className="primary-button min-h-8 px-3 text-[11px]"
              >
                <Send className="h-3.5 w-3.5" />
                Submit
              </button>
            </div>
          </div>
          <div className="flex min-h-[410px] flex-1 overflow-hidden bg-[#111216]">
            <div className="w-10 flex-none select-none border-r border-white/[.06] bg-[#15161b] py-5 text-right font-mono text-[10px] leading-6 text-[#555862]">
              {lineNumbers.map(number => (
                <div key={number} className="pr-3">
                  {number}
                </div>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <Editor
                height="100%"
                defaultLanguage="typescript"
                value={code}
                onChange={value => setCode(value ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  padding: { top: 20 },
                }}
              />
            </div>
          </div>
          <div className="border-t border-white/[.09] bg-[#17181d]">
            <div className="flex items-center gap-2 border-b border-white/[.08] px-4 py-2">
              <button className="case-tab is-active">
                <TerminalSquare className="h-3.5 w-3.5 text-[#f04432]" />
                Test results
              </button>
              <button className="case-tab">Console</button>
              <button className="case-tab">Custom case</button>
            </div>
            <div className="flex min-h-[108px] items-center gap-3 p-4">
              {runState === "idle" && (
                <>
                  <Code2 className="h-5 w-5 text-[#666973]" />
                  <p className="text-xs text-[#858893]">
                    Run your code to see the test result.
                  </p>
                </>
              )}
              {runState === "running" && (
                <>
                  <Timer className="h-5 w-5 animate-pulse text-[#e1a759]" />
                  <p className="font-mono text-xs text-[#d9bd83]">
                    EXECUTING TESTS...
                  </p>
                </>
              )}
              {runState === "passed" && (
                <div className="w-full">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-[#b5df73]" />
                    <p className="font-mono text-xs text-[#cde7a5]">
                      6 / 6 SAMPLE TESTS PASSED
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="runner-card">
                      <span>Runtime</span>
                      <strong>84 ms</strong>
                    </div>
                    <div className="runner-card">
                      <span>Memory</span>
                      <strong>46.1 MB</strong>
                    </div>
                    <div className="runner-card">
                      <span>Match rank</span>
                      <strong>Top 18%</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
