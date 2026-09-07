/**
 * Style system: Tournament Console — a compact professional coding arena with broadcast player readouts,
 * timer emphasis, code-runner micro-panels, and no distraction from the live contest.
 */
import { Avatar, MatchLine, Pill } from "@/components/ArenaPrimitives";
import {
  Check,
  Code2,
  Play,
  Send,
  TerminalSquare,
  Timer,
  Wifi,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useBattleData } from "@/hooks/useBattleData";
import { useMatchSocket } from "@/hooks/useMatchSocket";

const lineNumbers = Array.from({ length: 15 }, (_, index) => index + 1);

// --- Starter code templates (stdin/stdout style) ---
const starterCodes: Record<string, string> = {
  python: `import sys
input = sys.stdin.readline

def solve():
    # Read input and print output
    pass

solve()`,
  javascript: `const lines = require('fs').readFileSync(0,'utf-8').split('\\n');
let ptr = 0;
const readline = () => lines[ptr++]?.trim() ?? '';

// Write your solution here
`,
  typescript: `import * as fs from 'fs';
const lines = fs.readFileSync(0,'utf-8').split('\\n');
let ptr = 0;
const readline = (): string => lines[ptr++]?.trim() ?? '';

// Write your solution here
`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // Read input and print output
    }
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    
    return 0;
}`,
};

type Verdict = 
  | "accepted"
  | "wrong_answer"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "runtime_error"
  | "compilation_error"
  | "internal_error"
  | "pending";

const VERDICT_META: Record<string, { label: string; color: string; bg: string }> = {
  accepted:             { label: "Accepted",              color: "#6cb369", bg: "#6cb36915" },
  wrong_answer:         { label: "Wrong Answer",          color: "#e48b87", bg: "#e48b8715" },
  time_limit_exceeded:  { label: "Time Limit Exceeded",   color: "#e1a759", bg: "#e1a75915" },
  memory_limit_exceeded:{ label: "Memory Limit Exceeded", color: "#e1a759", bg: "#e1a75915" },
  runtime_error:        { label: "Runtime Error",         color: "#e48b87", bg: "#e48b8715" },
  compilation_error:    { label: "Compilation Error",     color: "#e48b87", bg: "#e48b8715" },
  internal_error:       { label: "Internal Error",        color: "#989ba5", bg: "#989ba515" },
  pending:              { label: "Pending",               color: "#989ba5", bg: "#989ba515" },
};

interface TestResult {
  testIndex: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr?: string;
  compileOutput?: string;
  details?: string;
}

function TestCasePanel({ results, activeIndex, onSelect }: {
  results: TestResult[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  const active = results[activeIndex];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-0 h-full">
      <div className="flex gap-1 px-4 pt-3 pb-0 flex-wrap">
        {results.map((r, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-t border-b-2 transition-colors ${
              activeIndex === i
                ? r.passed
                  ? "border-[#6cb369] text-[#6cb369] bg-[#6cb36910]"
                  : "border-[#e48b87] text-[#e48b87] bg-[#e48b8710]"
                : "border-transparent text-[#858893] hover:text-[#c9cbd1]"
            }`}
          >
            {r.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            Case {i + 1}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <IOBlock label="Input" value={active.input} />
        <IOBlock label="Expected Output" value={active.expectedOutput} />
        <IOBlock
          label="Your Output"
          value={active.actualOutput}
          highlight={active.passed ? "green" : "red"}
          empty={!active.actualOutput}
        />
        {active.stderr && <IOBlock label="Stderr" value={active.stderr} highlight="amber" />}
        {active.compileOutput && <IOBlock label="Compilation Output" value={active.compileOutput} highlight="amber" />}
      </div>
    </div>
  );
}

function IOBlock({ label, value, highlight, empty }: { label: string; value: string; highlight?: "green" | "red" | "amber"; empty?: boolean; }) {
  const colors = {
    green: "border-[#6cb369]/30 bg-[#6cb36908]",
    red:   "border-[#e48b87]/30 bg-[#e48b8708]",
    amber: "border-[#e1a759]/30 bg-[#e1a75908]",
  };
  const borderClass = highlight ? colors[highlight] : "border-white/[.06] bg-white/[.02]";

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[.1em] text-[#666973] mb-1">{label}</p>
      <div className={`border rounded px-3 py-2 font-mono text-[12px] min-h-[36px] whitespace-pre-wrap break-all ${borderClass}`}>
        {empty ? <span className="text-[#555862] italic">No output</span> : <span className="text-[#d7d8dc]">{value}</span>}
      </div>
    </div>
  );
}

export default function Battle() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/battle/:matchId");
  
  const matchId = params?.matchId;
  const [roomId, setRoomId] = useState<string | null>(null);
  
  const [runState, setRunState] = useState<"idle" | "running" | "done">("idle");
  const [isSubmit, setIsSubmit] = useState(false);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(starterCodes.python);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<"testcase" | "result">("testcase");
  const [activeTestIdx, setActiveTestIdx] = useState(0);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [passedTests, setPassedTests] = useState(0);
  const [totalTests, setTotalTests] = useState(0);
  const [runtimeMs, setRuntimeMs] = useState<number | null>(null);
  
  const { socket, connected } = useMatchSocket();
  const { player, matchData, loading, error } = useBattleData(matchId || "no-match");

  useEffect(() => {
    setCode(starterCodes[language] || starterCodes.python);
  }, [language]);

  useEffect(() => {
    if (!socket || !connected || !matchId || roomId) return;
    
    socket.emit("request_reconnect", { roomId: "", matchId });
    
    const handleRoomState = (payload: any) => {
      if (payload.roomId) setRoomId(payload.roomId);
      if (payload.endsAt) {
        const remaining = payload.endsAt - Date.now();
        setTimeRemainingMs(remaining > 0 ? remaining : 0);
      }
    };
    
    socket.on("room_state", handleRoomState);
    return () => { socket.off("room_state", handleRoomState); };
  }, [socket, connected, matchId, roomId]);

  useEffect(() => {
    if (!socket || !connected || !matchId) return;
    
    if (roomId) {
      socket.emit("request_reconnect", { roomId, matchId });
    }
    
    const handleMatchResult = (payload: any) => {
      setTimeout(() => setLocation(`/result/${matchId}`), 2000);
    };
    
    socket.on("match_result", handleMatchResult);
    return () => { socket.off("match_result", handleMatchResult); };
  }, [socket, connected, matchId, roomId, setLocation]);

  useEffect(() => {
    if (!socket) return;
    const handleTimer = (payload: { roomId: string; timeRemainingMs: number; }) => {
      if (payload.roomId === roomId || payload.roomId === matchId) {
        setTimeRemainingMs(payload.timeRemainingMs);
      }
    };
    
    const handleResult = (payload: {
      verdict: string;
      passedTests: number;
      totalTests: number;
      runtimeMs?: number | null;
      testResults?: TestResult[];
    }) => {
      setRunState("done");
      setVerdict(payload.verdict as Verdict);
      setPassedTests(payload.passedTests);
      setTotalTests(payload.totalTests);
      setRuntimeMs(payload.runtimeMs ?? null);
      if (payload.testResults) {
        setTestResults(payload.testResults);
      }
      setActiveTestIdx(0);
    };
    
    socket.on("timer_sync", handleTimer as any);
    socket.on("submission_result", handleResult as any);
    return () => {
      socket.off("timer_sync", handleTimer as any);
      socket.off("submission_result", handleResult as any);
    };
  }, [socket, matchId, roomId]);

  if (!matchId) {
    return (
      <div className="page-wrap enter-up p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="font-display text-3xl font-bold tracking-[-.06em]">No Active Battle</h2>
        <p className="mt-3 text-sm text-[#989ba5] max-w-md">Join matchmaking to find an opponent.</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setLocation("/matchmaking")} className="primary-button">Find Match</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">Loading match...</div>;
  if (error || !player) return <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">Error loading match.</div>;

  const opponent = matchData?.opponent || { handle: "rohanbits", initials: "RM", rating: 1856 };
  
  const formatTime = (milliseconds: number | null) => {
    if (milliseconds === null) return "--:--";
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  
  const handleRun = (action: "run" | "submit" = "submit") => {
    if (!socket || !connected || !roomId || !matchId) return;
    
    setRunState("running");
    setIsSubmit(action === "submit");
    setActiveTab("result");
    setTestResults([]);
    setVerdict("pending");
    
    socket.emit("submit_code", {
      roomId,
      matchId,
      language,
      sourceCode: code,
      action,
    });
  };

  const problem = matchData?.problem || {
    title: "Minimum Window",
    topic: "STRING / SLIDING WINDOW",
    difficulty: "Medium",
    points: 25,
    statement: "Given strings s and t...",
    constraints: [],
    examples: [],
  };

  const vm = verdict ? (VERDICT_META[verdict] || VERDICT_META.pending) : null;

  return (
    <div className="page-wrap enter-up flex flex-col h-screen overflow-hidden">
      <header className="battle-header border-b border-white/10 px-4 py-3 sm:px-5 shrink-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[.13em] text-[#f4877b]">Battle in progress</span>
          </div>
          <div className="hidden h-5 w-px bg-white/10 md:block" />
          <div className="battle-player">
            <Avatar initials={player.initials} size="sm" />
            <span className="font-mono text-[11px] text-[#d5d6da]">{player.handle}</span>
            <span className="font-mono text-[10px] text-[#8f929c]">{player.rating}</span>
          </div>
          <div className="battle-player">
            <Avatar initials={opponent.initials} tone="blue" size="sm" />
            <span className="font-mono text-[11px] text-[#d5d6da]">{opponent.handle}</span>
            <span className="font-mono text-[10px] text-[#8f929c]">{opponent.rating}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="battle-timer">
              <span className="section-kicker block">Time remaining</span>
              <span className="font-mono text-xl font-medium tracking-[-.05em] text-[#f5f2eb] sm:text-2xl">
                {formatTime(timeRemainingMs ?? (matchData?.timeRemainingSeconds ? matchData.timeRemainingSeconds * 1000 : null))}
              </span>
            </div>
            <div className="hidden h-10 w-px bg-white/10 sm:block" />
            <div>
              <span className="section-kicker block">Match</span>
              <span className="font-mono text-xs text-[#d1d2d7]">{matchData?.matchCode || `#${matchId.substring(0, 4).toUpperCase()}`}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex min-h-0">
        <section className="w-[400px] shrink-0 border-r border-white/[.08] bg-[#0f1014] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h1 className="font-display text-2xl font-bold tracking-[-.06em]">{problem.title}</h1>
                <Pill tone={problem.difficulty === "Easy" ? "lime" : problem.difficulty === "Medium" ? "blue" : "red"}>{problem.difficulty}</Pill>
              </div>
              <p className="text-sm leading-[1.7] text-[#b9bbc3] whitespace-pre-line">{problem.statement}</p>
            </div>
            {problem.constraints?.length > 0 && (
              <div>
                <p className="section-kicker mb-2">Constraints</p>
                <ul className="space-y-1">
                  {problem.constraints.map((c: string, i: number) => <li key={i} className="text-xs text-[#9295a0] font-mono">• {c}</li>)}
                </ul>
              </div>
            )}
            {problem.examples?.length > 0 && (
              <div>
                <p className="section-kicker mb-3">Examples</p>
                <div className="space-y-3">
                  {problem.examples.map((ex: any, i: number) => (
                    <div key={i} className="border border-white/[.08] bg-white/[.02] rounded p-3">
                      <p className="text-[10px] font-mono uppercase tracking-[.08em] text-[#666973] mb-2">Example {i + 1}</p>
                      <div className="grid gap-1.5">
                        <div><span className="text-[10px] text-[#666973] font-mono">Input</span><pre className="mt-0.5 font-mono text-xs text-[#b9bbc3] bg-[#111215] border border-white/[.06] rounded px-2 py-1.5 overflow-x-auto">{ex.input}</pre></div>
                        <div><span className="text-[10px] text-[#666973] font-mono">Output</span><pre className="mt-0.5 font-mono text-xs text-[#6cb369] bg-[#111215] border border-white/[.06] rounded px-2 py-1.5 overflow-x-auto">{ex.output}</pre></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="border-t border-white/[.08] pt-5">
              <div className="flex items-center justify-between"><p className="section-kicker">Opponent signal</p><Pill tone="blue"><Wifi className="h-3 w-3" /> Connected</Pill></div>
              <p className="mt-3 text-xs leading-5 text-[#979aa4]">Your opponent is working. No solution progress has been revealed.</p>
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col min-w-0">
          <div className="shrink-0 border-b border-white/[.08] bg-[#0f1014] px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#666973]" />
              <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-[#17181d] border border-white/[.08] px-2.5 py-1 text-xs text-[#c9cbd1] rounded font-mono cursor-pointer">
                <option value="python">Python 3</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleRun("run")} disabled={runState === "running"} className="secondary-button min-h-8 px-3 text-xs disabled:opacity-50">
                {runState === "running" && !isSubmit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run
              </button>
              <button onClick={() => handleRun("submit")} disabled={runState === "running"} className="primary-button min-h-8 px-3 text-xs disabled:opacity-50">
                {runState === "running" && isSubmit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-[#111216]">
            <Editor
              height="100%"
              language={language === "cpp" ? "cpp" : language === "typescript" ? "typescript" : language}
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v || "")}
              options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "on", padding: { top: 12 } }}
            />
          </div>

          <div className="shrink-0 border-t border-white/[.08] bg-[#0f1014]" style={{ height: "260px", display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-0">
              <div className="flex">
                <button onClick={() => setActiveTab("testcase")} className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono border-b-2 transition-colors ${activeTab === "testcase" ? "border-[#f04432] text-[#e9e9eb]" : "border-transparent text-[#666973] hover:text-[#989ba5]"}`}>
                  <TerminalSquare className="h-3.5 w-3.5" /> Test Cases
                </button>
                <button onClick={() => setActiveTab("result")} className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono border-b-2 transition-colors ${activeTab === "result" ? "border-[#f04432] text-[#e9e9eb]" : "border-transparent text-[#666973] hover:text-[#989ba5]"}`}>
                  Results
                  {runState === "done" && <span className="ml-1 font-mono text-[10px]" style={{ color: vm?.color }}>{passedTests}/{totalTests}</span>}
                </button>
              </div>
              {runState === "running" && <div className="flex items-center gap-1.5 text-[#e1a759] text-[11px] font-mono"><Loader2 className="h-3 w-3 animate-spin" />{isSubmit ? "Submitting..." : "Running..."}</div>}
              {runState === "done" && vm && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold" style={{ color: vm.color, background: vm.bg }}>
                  {verdict === "accepted" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {vm.label}
                  {runtimeMs != null && <span className="ml-2 text-[#666973] font-normal">· {runtimeMs}ms</span>}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              {activeTab === "testcase" && (
                <div className="h-full overflow-y-auto">
                  {runState === "idle" && <div className="flex items-center gap-3 px-4 py-5 text-[#555862]"><Play className="h-4 w-4" /><p className="text-xs">Click <strong className="text-[#858893]">Run</strong> to execute against sample test cases.</p></div>}
                  {runState === "running" && <div className="flex items-center gap-3 px-4 py-5 text-[#e1a759]"><Loader2 className="h-4 w-4 animate-spin" /><p className="text-xs font-mono">Executing test cases...</p></div>}
                  {runState === "done" && testResults.length > 0 && <TestCasePanel results={testResults} activeIndex={activeTestIdx} onSelect={setActiveTestIdx} />}
                </div>
              )}
              {activeTab === "result" && (
                <div className="h-full overflow-y-auto px-4 py-3">
                  {runState === "idle" && <div className="flex items-center gap-3 text-[#555862]"><Send className="h-4 w-4" /><p className="text-xs">Submit your code to see the full results.</p></div>}
                  {runState === "running" && <div className="flex items-center gap-3 text-[#e1a759]"><Loader2 className="h-4 w-4 animate-spin" /><p className="text-xs font-mono">{isSubmit ? "Running all test cases..." : "Running sample tests..."}</p></div>}
                  {runState === "done" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-2 rounded border text-sm font-semibold" style={{ color: vm?.color, borderColor: `${vm?.color}40`, background: vm?.bg }}>
                          {verdict === "accepted" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          {vm?.label}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#858893]">
                          <span className="font-mono font-semibold text-[#d7d8dc]">{passedTests}</span><span>/</span><span className="font-mono font-semibold text-[#d7d8dc]">{totalTests}</span><span className="ml-1">tests passed</span>
                        </div>
                        {runtimeMs != null && <div className="flex items-center gap-1.5 text-xs text-[#858893]"><Clock className="h-3 w-3" />{runtimeMs} ms</div>}
                      </div>
                      {testResults.length > 0 && <TestCasePanel results={testResults} activeIndex={activeTestIdx} onSelect={setActiveTestIdx} />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
