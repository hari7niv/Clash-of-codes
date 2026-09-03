/**
 * Practice Problem Page - Solo problem solving with real submissions
 */
import { MatchLine, Pill } from "@/components/ArenaPrimitives";
import {
  Check,
  ChevronDown,
  Code2,
  Play,
  Send,
  TerminalSquare,
  ArrowLeft,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { api } from "@/lib/api";
import { toast } from "sonner";

const starterCodes: Record<string, string> = {
  python: `def solve():
    # write code here
    pass`,
  javascript: `function solve() {
  // write code here
}`,
  typescript: `function solve(): void {
  // write code here
}`,
  java: `public class Solution {
    public static void solve() {
        // write code here
    }
}`,
  cpp: `#include <iostream>
using namespace std;

void solve() {
    // write code here
}`,
};

export default function PracticeProblem() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/practice/:problemId");
  const problemId = params?.problemId;

  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runState, setRunState] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [language, setLanguage] = useState("typescript");
  const [code, setCode] = useState(starterCodes.typescript);
  const [submissionStatus, setSubmissionStatus] = useState("Run your code to see test results.");
  const [testResults, setTestResults] = useState<any>(null);

  // Fetch problem data
  useEffect(() => {
    if (!problemId) return;
    
    async function loadProblem() {
      try {
        setLoading(true);
        const res = await api.get(`/problems/${problemId}`);
        setProblem(res.data);
        
        // Set starter code for selected language
        if (res.data.starterCode && res.data.starterCode[language]) {
          setCode(res.data.starterCode[language]);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.error?.message || "Failed to load problem");
        setLocation("/practice");
      } finally {
        setLoading(false);
      }
    }

    loadProblem();
  }, [problemId]);

  // Update code when language changes
  useEffect(() => {
    if (problem?.starterCode?.[language]) {
      setCode(problem.starterCode[language]);
    } else {
      setCode(starterCodes[language] || starterCodes.typescript);
    }
  }, [language, problem]);

  const handleRun = async () => {
    setRunState("running");
    setSubmissionStatus("Running tests...");
    
    try {
      const res = await api.post("/practice/submit", {
        problemId,
        language,
        code,
        action: "run" // Run sample tests only
      });

      const { submissionId } = res.data;
      
      // Poll for results
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const resultRes = await api.get(`/practice/submissions/${submissionId}`);
          const result = resultRes.data;
          
          if (result.verdict !== "pending") {
            clearInterval(pollInterval);
            setTestResults(result);
            
            if (result.verdict === "ac") {
              setRunState("passed");
              setSubmissionStatus(`All ${result.passedTests}/${result.totalTests} sample tests passed!`);
            } else {
              setRunState("failed");
              setSubmissionStatus(`${result.passedTests}/${result.totalTests} tests passed. ${result.verdict.toUpperCase()}`);
            }
          }
        } catch (err) {
          // Continue polling
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setRunState("idle");
          setSubmissionStatus("Timed out waiting for results.");
        }
      }, 1000);
      
    } catch (err: any) {
      setRunState("idle");
      setSubmissionStatus("Failed to submit code.");
      toast.error(err.response?.data?.error?.message || "Submission failed");
    }
  };

  const handleSubmit = async () => {
    setRunState("running");
    setSubmissionStatus("Submitting to full test suite...");
    
    try {
      const res = await api.post("/practice/submit", {
        problemId,
        language,
        code,
        action: "submit" // Run full test suite
      });

      const { submissionId } = res.data;
      
      // Poll for results
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const resultRes = await api.get(`/practice/submissions/${submissionId}`);
          const result = resultRes.data;
          
          if (result.verdict !== "pending") {
            clearInterval(pollInterval);
            setTestResults(result);
            
            if (result.verdict === "ac") {
              setRunState("passed");
              setSubmissionStatus(`Accepted! All ${result.totalTests} tests passed.`);
              toast.success("Problem solved! 🎉");
              
              // Navigate back after a delay
              setTimeout(() => setLocation("/practice"), 2000);
            } else {
              setRunState("failed");
              setSubmissionStatus(`${result.passedTests}/${result.totalTests} tests passed. ${result.verdict.toUpperCase()}`);
            }
          }
        } catch (err) {
          // Continue polling
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setRunState("idle");
          setSubmissionStatus("Timed out waiting for results.");
        }
      }, 1000);
      
    } catch (err: any) {
      setRunState("idle");
      setSubmissionStatus("Failed to submit code.");
      toast.error(err.response?.data?.error?.message || "Submission failed");
    }
  };

  if (loading) {
    return (
      <div className="page-wrap enter-up p-8 flex justify-center text-[#848792]">
        Loading problem...
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="page-wrap enter-up p-8 flex justify-center text-[#e48b87]">
        Problem not found
      </div>
    );
  }

  return (
    <div className="page-wrap enter-up">
      {/* Header */}
      <header className="border-b border-white/[.08] bg-[#0f1014] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/practice")}
              className="secondary-button min-h-8 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <MatchLine label={`Practice / ${problem.topic}`} />
              <h1 className="mt-1 font-display text-xl font-bold tracking-[-.05em]">
                {problem.title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={problem.difficulty === "Easy" ? "lime" : problem.difficulty === "Medium" ? "blue" : "red"}>
              {problem.difficulty}
            </Pill>
            <span className="text-xs text-[#989ba5]">{problem.points} pts</span>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-2">
        {/* Left: Problem Statement */}
        <section className="border-r border-white/[.08] bg-[#0f1014] p-5 lg:p-7 overflow-y-auto max-h-[calc(100vh-80px)]">
          <div>
            <h2 className="font-display text-lg font-bold tracking-[-.045em]">Problem Statement</h2>
            <div className="mt-4 prose prose-invert prose-sm max-w-none">
              <p className="text-sm leading-6 text-[#b9bbc3]">{problem.statement}</p>
            </div>
          </div>

          {problem.constraints && problem.constraints.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-base font-bold tracking-[-.04em]">Constraints</h3>
              <ul className="mt-2 space-y-1">
                {problem.constraints.map((constraint: string, idx: number) => (
                  <li key={idx} className="text-xs text-[#9295a0]">• {constraint}</li>
                ))}
              </ul>
            </div>
          )}

          {problem.examples && problem.examples.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-base font-bold tracking-[-.04em]">Examples</h3>
              <div className="mt-3 space-y-4">
                {problem.examples.map((example: any, idx: number) => (
                  <div key={idx} className="border border-white/[.08] bg-white/[.02] p-3">
                    <p className="text-xs font-semibold text-[#c9cbd1]">Example {idx + 1}</p>
                    <div className="mt-2">
                      <p className="text-[10px] text-[#747783]">Input:</p>
                      <pre className="mt-1 font-mono text-xs text-[#b9bbc3]">{example.input}</pre>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] text-[#747783]">Output:</p>
                      <pre className="mt-1 font-mono text-xs text-[#b9bbc3]">{example.output}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right: Code Editor */}
        <section className="flex flex-col bg-[#1a1b1f]">
          {/* Editor Controls */}
          <div className="border-b border-white/[.08] bg-[#0f1014] px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#747783]" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-[#1a1b1f] border border-white/[.08] px-2 py-1 text-xs text-[#c9cbd1] rounded"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRun}
                  disabled={runState === "running"}
                  className="secondary-button min-h-8 px-3 text-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={runState === "running"}
                  className="primary-button min-h-8 px-3 text-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit
                </button>
              </div>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1">
            <Editor
              height="calc(100vh - 250px)"
              language={language === "cpp" ? "cpp" : language}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                renderLineHighlight: "line",
                scrollBeyondLastLine: false,
                tabSize: 2,
              }}
            />
          </div>

          {/* Test Results Panel */}
          <div className="border-t border-white/[.08] bg-[#0f1014] p-4">
            <div className="flex items-center gap-2">
              <TerminalSquare className="h-4 w-4 text-[#747783]" />
              <span className="text-xs font-semibold text-[#c9cbd1]">Test Results</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {runState === "passed" && <Check className="h-4 w-4 text-[#6cb369]" />}
              {runState === "failed" && <span className="text-[#e48b87]">✗</span>}
              <p className="text-xs text-[#989ba5]">{submissionStatus}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
