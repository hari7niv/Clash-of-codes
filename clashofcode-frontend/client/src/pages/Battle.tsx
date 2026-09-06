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
  X,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useBattleData } from "@/hooks/useBattleData";
import { useMatchSocket } from "@/hooks/useMatchSocket";

const lineNumbers = Array.from({ length: 15 }, (_, index) => index + 1);

const starterCodes: Record<string, string> = {
  typescript: `function minWindow(s: string, t: string): string {
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
}`,
  javascript: `function minWindow(s, t) {
  const need = new Map();
  for (const char of t) need.set(char, (need.get(char) ?? 0) + 1);

  let left = 0;
  let matched = 0;
  let best = [0, Infinity];

  for (let right = 0; right < s.length; right++) {
    const char = s[right];
    // your implementation
  }

  return best[1] === Infinity ? "" : s.slice(best[0], best[1] + 1);
}`,
  python: `def min_window(s: str, t: str) -> str:
    # your implementation
    pass`,
  java: `public class Solution {
    public String minWindow(String s, String t) {
        // your implementation
        return "";
    }
}`,
  cpp: `#include <string>
using namespace std;

string minWindow(string s, string t) {
    // your implementation
    return "";
}`,
};

// Verdict type matching backend
type Verdict = 
  | "accepted"
  | "wrong_answer"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "runtime_error"
  | "compilation_error"
  | "internal_error";

// Human-readable verdict descriptions
const verdictDescriptions: Record<Verdict, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "Time Limit Exceeded",
  memory_limit_exceeded: "Memory Limit Exceeded",
  runtime_error: "Runtime Error",
  compilation_error: "Compilation Error",
  internal_error: "Internal Error",
};

export default function Battle() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/battle/:matchId");
  
  // Validate matchId - if none provided, redirect to matchmaking
  const matchId = params?.matchId;
  
  // FIX P0 BUG 1: Proper room ID resolution state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [runState, setRunState] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [language, setLanguage] = useState("typescript");
  const [code, setCode] = useState(starterCodes.typescript);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState(
    "Run your code to see the test result."
  );
  const [resultTab, setResultTab] = useState<"tests" | "console" | "custom">("tests");
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [customInput, setCustomInput] = useState<string>("");
  
  const { socket, connected } = useMatchSocket();
  const { player, matchData, loading, error } = useBattleData(matchId || "no-match");

  // Update starter code when language changes
  useEffect(() => {
    setCode(starterCodes[language] || starterCodes.typescript);
  }, [language]);

  // FIX P0 BUG 1: Resolve roomId from matchId via match-server (new flow)
  // Step 1: When we have matchId but no roomId, emit resolve_match_room
  useEffect(() => {
    if (!socket || !connected || !matchId || roomId) return;
    
    console.log(`[Battle] Resolving roomId for match ${matchId}`);
    
    // Emit new resolve_match_room event with just matchId
    socket.emit("resolve_match_room", { matchId });
    
    // Listen for match_room_resolved response
    const handleMatchRoomResolved = (payload: any) => {
      console.log(`[Battle] Match room resolved:`, payload);
      if (payload.matchId === matchId && payload.roomId) {
        setRoomId(payload.roomId);
      }
    };
    
    socket.on("match_room_resolved", handleMatchRoomResolved);
    
    return () => {
      socket.off("match_room_resolved", handleMatchRoomResolved);
    };
  }, [socket, connected, matchId, roomId]);

  // FIX P0 BUG 3: Implement reconnect flow on socket connect/reconnect
  // Step 2: After roomId is resolved, emit request_reconnect with actual roomId
  useEffect(() => {
    if (!socket || !connected || !matchId || !roomId) return;
    
    console.log(`[Battle] Socket connected with roomId=${roomId}, emitting reconnect for match ${matchId}`);
    
    // Now we have actual roomId, can properly reconnect
    socket.emit("request_reconnect", { roomId, matchId });
    
    // Listen for room_state response to get full room snapshot
    const handleRoomState = (payload: any) => {
      console.log(`[Battle] Received room_state:`, payload);
      if (payload.endsAt) {
        const remaining = payload.endsAt - Date.now();
        setTimeRemainingMs(remaining > 0 ? remaining : 0);
      }
    };
    
    // Listen for match result
    const handleMatchResult = (payload: any) => {
      console.log(`[Battle] Match result received:`, payload);
      // Navigate to result page
      setTimeout(() => {
        setLocation(`/result/${matchId}`);
      }, 2000);
    };
    
    socket.on("room_state", handleRoomState);
    socket.on("match_result", handleMatchResult);
    
    return () => {
      socket.off("room_state", handleRoomState);
      socket.off("match_result", handleMatchResult);
    };
  }, [socket, connected, matchId, roomId, setLocation]);

  // Socket event handlers for timer and submission results
  useEffect(() => {
    if (!socket) return;
    const handleTimer = (payload: {
      roomId: string;
      timeRemainingMs: number;
    }) => {
      // Match by roomId if we have it, otherwise by matchId
      if (payload.roomId === roomId || payload.roomId === matchId) {
        setTimeRemainingMs(payload.timeRemainingMs);
      }
    };
    
    // FIX 2b: Handle all verdict types properly
    const handleResult = (payload: {
      verdict: string;
      passedTests: number;
      totalTests: number;
      runtimeMs?: number | null;
      stdout?: string;
      stderr?: string;
      compileOutput?: string;
    }) => {
      const verdict = payload.verdict as Verdict;
      
      if (verdict === "accepted") {
        setRunState("passed");
        setSubmissionStatus(`All ${payload.totalTests}/${payload.totalTests} tests passed!`);
      } else {
        setRunState("failed");
        const verdictLabel = verdictDescriptions[verdict] || verdict.toUpperCase();
        setSubmissionStatus(
          `${payload.passedTests}/${payload.totalTests} tests passed. ${verdictLabel}`
        );
      }
      
      // Collect console output from stdout/stderr/compile errors
      const outputLines: string[] = [];
      if (payload.stdout) outputLines.push(`[STDOUT]\n${payload.stdout}`);
      if (payload.stderr) outputLines.push(`[STDERR]\n${payload.stderr}`);
      if (payload.compileOutput) outputLines.push(`[COMPILE OUTPUT]\n${payload.compileOutput}`);
      setConsoleOutput(outputLines.length > 0 ? outputLines.join("\n\n") : "No output captured.");
    };
    
    socket.on("timer_sync", handleTimer as any);
    socket.on("submission_result", handleResult as any);
    return () => {
      socket.off("timer_sync", handleTimer as any);
      socket.off("submission_result", handleResult as any);
    };
  }, [socket, matchId, roomId]);

  // FIX 2a: CONDITIONAL RETURNS ONLY AFTER ALL HOOKS
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
              onClick={() => setLocation("/rooms/create")}
              className="secondary-button"
            >
              Create Room
            </button>
          </div>
        </div>
      </div>
    );
  }

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
  
  // FIX P0 BUG 2: Use resolved roomId state and include matchId in payload
  const formatTime = (milliseconds: number | null) => {
    if (milliseconds === null) return "--:--";
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  
  const submitCode = (action: "run" | "submit" = "submit") => {
    if (!socket || !connected) return;
    if (!roomId || !matchId) {
      console.error("[Battle] Cannot submit: roomId or matchId not resolved");
      setSubmissionStatus("Error: Room not ready. Please refresh.");
      return;
    }
    
    setRunState("running");
    setSubmissionStatus(
      action === "run" ? "RUNNING SAMPLE TESTS..." : "SUBMITTED FOR JUDGING..."
    );
    setConsoleOutput(""); // Clear previous output
    
    console.log(`[Battle] Submitting code: roomId=${roomId}, matchId=${matchId}, action=${action}`);
    
    socket.emit("submit_code", {
      roomId,        // Resolved from match-server
      matchId,       // FIX P0 BUG 2: Include matchId
      language: language,
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
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flex items-center gap-2 border border-white/10 bg-white/[.035] px-2.5 py-1.5 font-mono text-[10px] text-[#d5d6da] cursor-pointer"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
              <span className="font-mono text-[10px] text-[#6f727c]">
                main.{language === "typescript" ? "ts" : language === "javascript" ? "js" : language === "python" ? "py" : language === "java" ? "java" : "cpp"}
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
                language={language === "cpp" ? "cpp" : language}
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
              <button 
                className={`case-tab ${resultTab === "tests" ? "is-active" : ""}`}
                onClick={() => setResultTab("tests")}
              >
                <TerminalSquare className="h-3.5 w-3.5 text-[#f04432]" />
                Test results
              </button>
              <button 
                className={`case-tab ${resultTab === "console" ? "is-active" : ""}`}
                onClick={() => setResultTab("console")}
              >
                Console
              </button>
              <button 
                className={`case-tab ${resultTab === "custom" ? "is-active" : ""}`}
                onClick={() => setResultTab("custom")}
              >
                Custom case
              </button>
            </div>
            <div className="flex min-h-[108px] items-start p-4">
              {/* FIX 2c: Tab content based on selected tab */}
              {resultTab === "tests" && (
                <>
                  {runState === "idle" && (
                    <div className="flex items-center gap-3">
                      <Code2 className="h-5 w-5 text-[#666973]" />
                      <p className="text-xs text-[#858893]">
                        Run your code to see the test result.
                      </p>
                    </div>
                  )}
                  {runState === "running" && (
                    <div className="flex items-center gap-3">
                      <Timer className="h-5 w-5 animate-pulse text-[#e1a759]" />
                      <p className="font-mono text-xs text-[#d9bd83]">
                        EXECUTING TESTS...
                      </p>
                    </div>
                  )}
                  {runState === "passed" && (
                    <div className="w-full">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-[#b5df73]" />
                        <p className="font-mono text-xs text-[#cde7a5]">
                          {submissionStatus}
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
                  {/* FIX 2b: Failed state with actual verdict information */}
                  {runState === "failed" && (
                    <div className="w-full">
                      <div className="flex items-center gap-2">
                        <X className="h-5 w-5 text-[#e48b87]" />
                        <p className="font-mono text-xs text-[#e9b3b0]">
                          {submissionStatus}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* FIX 2c: Console tab shows stdout/stderr */}
              {resultTab === "console" && (
                <div className="w-full">
                  <p className="text-[10px] text-[#747783] mb-2">Program output:</p>
                  <pre className="font-mono text-[11px] text-[#b9bbc3] bg-[#111216] p-3 border border-white/[.06] max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                    {consoleOutput || "No output yet. Run your code to see console output."}
                  </pre>
                </div>
              )}
              
              {/* FIX 2c: Custom case tab - basic UI (full implementation may need backend support) */}
              {resultTab === "custom" && (
                <div className="w-full space-y-3">
                  <div>
                    <label className="text-[10px] text-[#747783] block mb-1">Custom Input:</label>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Enter custom test input..."
                      className="w-full h-20 bg-[#111216] border border-white/[.08] p-2 font-mono text-xs text-[#d5d6da] resize-none"
                    />
                  </div>
                  <p className="text-[10px] text-[#747783]">
                    Note: Custom test execution requires backend support. Use the Run button to test with sample inputs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
