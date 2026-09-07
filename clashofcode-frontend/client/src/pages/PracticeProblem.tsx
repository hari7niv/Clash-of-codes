/**
 * Practice Problem Page — LeetCode-style with per-test-case results panel
 */
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Play,
  Send,
  TerminalSquare,
  ArrowLeft,
  X,
  Clock,
  Cpu,
  Loader2,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { MatchLine, Pill } from "@/components/ArenaPrimitives";

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

interface SubmissionResult {
  verdict: string;
  passedTests: number;
  totalTests: number;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  testResults: TestResult[];
}

type RunState = "idle" | "running" | "done";

function TestCasePanel({ results, activeIndex, onSelect }: {
  results: TestResult[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  const active = results[activeIndex];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Tab bar */}
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
            {r.passed
              ? <Check className="h-3 w-3" />
              : <X className="h-3 w-3" />
            }
            Case {i + 1}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <IOBlock label="Input" value={active.input} />
        <IOBlock label="Expected Output" value={active.expectedOutput} />
        <IOBlock
          label="Your Output"
          value={active.actualOutput}
          highlight={active.passed ? "green" : "red"}
          empty={!active.actualOutput}
        />
        {active.stderr && (
          <IOBlock label="Stderr" value={active.stderr} highlight="amber" />
        )}
        {active.compileOutput && (
          <IOBlock label="Compilation Output" value={active.compileOutput} highlight="amber" />
        )}
      </div>
    </div>
  );
}

function IOBlock({
  label,
  value,
  highlight,
  empty,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red" | "amber";
  empty?: boolean;
}) {
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
        {empty ? (
          <span className="text-[#555862] italic">No output</span>
        ) : (
          <span className="text-[#d7d8dc]">{value}</span>
        )}
      </div>
    </div>
  );
}

export default function PracticeProblem() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/practice/:problemId");
  const problemId = params?.problemId;

  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runState, setRunState] = useState<RunState>("idle");
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(starterCodes.python);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [activeTab, setActiveTab] = useState<"testcase" | "result">("testcase");
  const [activeTestIdx, setActiveTestIdx] = useState(0);
  const [isSubmit, setIsSubmit] = useState(false);

  // Fetch problem
  useEffect(() => {
    if (!problemId) return;
    async function load() {
      try {
        setLoading(true);
        const res = await api.get(`/problems/${problemId}`);
        setProblem(res.data);
      } catch (err: any) {
        toast.error("Failed to load problem");
        setLocation("/practice");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [problemId]);

  // Update code when language changes
  useEffect(() => {
    setCode(starterCodes[language] || starterCodes.python);
  }, [language]);

  const pollResult = async (submissionId: string) => {
    let attempts = 0;
    const max = 60;
    return new Promise<SubmissionResult>((resolve, reject) => {
      const timer = setInterval(async () => {
        attempts++;
        try {
          const r = await api.get(`/practice/submissions/${submissionId}`);
          if (r.data.verdict !== "pending") {
            clearInterval(timer);
            resolve(r.data);
          }
        } catch {}
        if (attempts >= max) {
          clearInterval(timer);
          reject(new Error("Timed out"));
        }
      }, 1000);
    });
  };

  const handleRun = async (action: "run" | "submit") => {
    setRunState("running");
    setResult(null);
    setIsSubmit(action === "submit");
    setActiveTab("result");

    try {
      const res = await api.post("/practice/submit", {
        problemId,
        language,
        code,
        action,
      });

      const data = await pollResult(res.data.submissionId);
      setResult(data);
      setRunState("done");
      setActiveTestIdx(0);

      if (action === "submit" && data.verdict === "accepted") {
        toast.success("Accepted! All tests passed 🎉");
        setTimeout(() => setLocation("/practice"), 2000);
      }
    } catch (err: any) {
      setRunState("idle");
      toast.error(err.message || "Submission failed");
    }
  };

  if (loading) return (
    <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">
      Loading problem...
    </div>
  );
  if (!problem) return (
    <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">
      Problem not found
    </div>
  );

  const verdict = result?.verdict;
  const vm = verdict ? (VERDICT_META[verdict] || VERDICT_META.pending) : null;

  return (
    <div className="page-wrap enter-up flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b border-white/[.08] bg-[#0f1014] px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/practice")} className="icon-button h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[.1em] text-[#666973]">
              Practice / {problem.topic || problem.tags?.[0] || "General"}
            </p>
            <h1 className="font-display text-base font-bold tracking-[-.04em] mt-0.5">
              {problem.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={problem.difficulty === "Easy" ? "lime" : problem.difficulty === "Medium" ? "blue" : "red"}>
            {problem.difficulty}
          </Pill>
          <span className="text-xs text-[#858893]">{problem.points || problem.rating} pts</span>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* ── LEFT: Problem statement ── */}
        <section className="w-[400px] shrink-0 border-r border-white/[.08] bg-[#0f1014] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Statement */}
            <div>
              <p className="section-kicker mb-2">Description</p>
              <p className="text-sm leading-[1.7] text-[#b9bbc3] whitespace-pre-line">{problem.statement}</p>
            </div>

            {/* Constraints */}
            {problem.constraints?.length > 0 && (
              <div>
                <p className="section-kicker mb-2">Constraints</p>
                <ul className="space-y-1">
                  {problem.constraints.map((c: string, i: number) => (
                    <li key={i} className="text-xs text-[#9295a0] font-mono">• {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Examples */}
            {problem.examples?.length > 0 && (
              <div>
                <p className="section-kicker mb-3">Examples</p>
                <div className="space-y-3">
                  {problem.examples.map((ex: any, i: number) => (
                    <div key={i} className="border border-white/[.08] bg-white/[.02] rounded p-3">
                      <p className="text-[10px] font-mono uppercase tracking-[.08em] text-[#666973] mb-2">Example {i + 1}</p>
                      <div className="grid gap-1.5">
                        <div>
                          <span className="text-[10px] text-[#666973] font-mono">Input</span>
                          <pre className="mt-0.5 font-mono text-xs text-[#b9bbc3] bg-[#111215] border border-white/[.06] rounded px-2 py-1.5 overflow-x-auto">{ex.input}</pre>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#666973] font-mono">Output</span>
                          <pre className="mt-0.5 font-mono text-xs text-[#6cb369] bg-[#111215] border border-white/[.06] rounded px-2 py-1.5 overflow-x-auto">{ex.output}</pre>
                        </div>
                        {ex.explanation && (
                          <p className="text-xs text-[#888] mt-1 italic">{ex.explanation}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT: Editor + Results ── */}
        <section className="flex-1 flex flex-col min-w-0">
          {/* Editor toolbar */}
          <div className="shrink-0 border-b border-white/[.08] bg-[#0f1014] px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#666973]" />
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="bg-[#17181d] border border-white/[.08] px-2.5 py-1 text-xs text-[#c9cbd1] rounded font-mono cursor-pointer"
              >
                <option value="python">Python 3</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="practice-run-btn"
                onClick={() => handleRun("run")}
                disabled={runState === "running"}
                className="secondary-button min-h-8 px-3 text-xs disabled:opacity-50"
              >
                {runState === "running" && !isSubmit
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Play className="h-3.5 w-3.5" />}
                Run
              </button>
              <button
                id="practice-submit-btn"
                onClick={() => handleRun("submit")}
                disabled={runState === "running"}
                className="primary-button min-h-8 px-3 text-xs disabled:opacity-50"
              >
                {runState === "running" && isSubmit
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
                Submit
              </button>
            </div>
          </div>

          {/* Monaco */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={language === "cpp" ? "cpp" : language === "typescript" ? "typescript" : language}
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                renderLineHighlight: "line",
                scrollBeyondLastLine: false,
                tabSize: 4,
                padding: { top: 12 },
              }}
            />
          </div>

          {/* ── Bottom results panel ── */}
          <div className="shrink-0 border-t border-white/[.08] bg-[#0f1014]" style={{ height: "260px", display: "flex", flexDirection: "column" }}>
            {/* Panel tabs + verdict badge */}
            <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-0">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("testcase")}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono border-b-2 transition-colors ${
                    activeTab === "testcase"
                      ? "border-[#f04432] text-[#e9e9eb]"
                      : "border-transparent text-[#666973] hover:text-[#989ba5]"
                  }`}
                >
                  <TerminalSquare className="h-3.5 w-3.5" />
                  Test Cases
                </button>
                <button
                  onClick={() => setActiveTab("result")}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono border-b-2 transition-colors ${
                    activeTab === "result"
                      ? "border-[#f04432] text-[#e9e9eb]"
                      : "border-transparent text-[#666973] hover:text-[#989ba5]"
                  }`}
                >
                  Results
                  {result && (
                    <span className="ml-1 font-mono text-[10px]" style={{ color: vm?.color }}>
                      {result.passedTests}/{result.totalTests}
                    </span>
                  )}
                </button>
              </div>

              {/* Verdict badge */}
              {runState === "running" && (
                <div className="flex items-center gap-1.5 text-[#e1a759] text-[11px] font-mono">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isSubmit ? "Submitting..." : "Running..."}
                </div>
              )}
              {runState === "done" && vm && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold"
                  style={{ color: vm.color, background: vm.bg }}
                >
                  {verdict === "accepted"
                    ? <Check className="h-3.5 w-3.5" />
                    : <X className="h-3.5 w-3.5" />}
                  {vm.label}
                  {result?.runtimeMs != null && (
                    <span className="ml-2 text-[#666973] font-normal">· {result.runtimeMs}ms</span>
                  )}
                </div>
              )}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "testcase" && (
                <div className="h-full overflow-y-auto">
                  {runState === "idle" && (
                    <div className="flex items-center gap-3 px-4 py-5 text-[#555862]">
                      <Play className="h-4 w-4" />
                      <p className="text-xs">Click <strong className="text-[#858893]">Run</strong> to execute against sample test cases.</p>
                    </div>
                  )}
                  {runState === "running" && (
                    <div className="flex items-center gap-3 px-4 py-5 text-[#e1a759]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-xs font-mono">Executing test cases...</p>
                    </div>
                  )}
                  {runState === "done" && result?.testResults.length > 0 && (
                    <TestCasePanel
                      results={result.testResults}
                      activeIndex={activeTestIdx}
                      onSelect={setActiveTestIdx}
                    />
                  )}
                </div>
              )}

              {activeTab === "result" && (
                <div className="h-full overflow-y-auto px-4 py-3">
                  {runState === "idle" && (
                    <div className="flex items-center gap-3 text-[#555862]">
                      <Send className="h-4 w-4" />
                      <p className="text-xs">Submit your code to see the full results.</p>
                    </div>
                  )}
                  {runState === "running" && (
                    <div className="flex items-center gap-3 text-[#e1a759]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-xs font-mono">
                        {isSubmit ? "Running all test cases..." : "Running sample tests..."}
                      </p>
                    </div>
                  )}
                  {runState === "done" && result && (
                    <div className="space-y-4">
                      {/* Summary row */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded border text-sm font-semibold"
                          style={{ color: vm?.color, borderColor: `${vm?.color}40`, background: vm?.bg }}
                        >
                          {verdict === "accepted"
                            ? <Check className="h-4 w-4" />
                            : <X className="h-4 w-4" />}
                          {vm?.label}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#858893]">
                          <span className="font-mono font-semibold text-[#d7d8dc]">{result.passedTests}</span>
                          <span>/</span>
                          <span className="font-mono font-semibold text-[#d7d8dc]">{result.totalTests}</span>
                          <span className="ml-1">tests passed</span>
                        </div>
                        {result.runtimeMs != null && (
                          <div className="flex items-center gap-1.5 text-xs text-[#858893]">
                            <Clock className="h-3 w-3" />
                            {result.runtimeMs} ms
                          </div>
                        )}
                      </div>

                      {/* Per-test results */}
                      {result.testResults.length > 0 && (
                        <TestCasePanel
                          results={result.testResults}
                          activeIndex={activeTestIdx}
                          onSelect={setActiveTestIdx}
                        />
                      )}
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
