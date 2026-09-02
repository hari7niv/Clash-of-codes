import { Job } from "bullmq";
import { getDatabase } from "./db.js";
import { Judge0Client } from "./judge0-client.js";
import { compareOutput } from "./output-comparator.js";
import { mapJudge0StatusToVerdict, Verdict } from "./verdict-mapper.js";
import postgres from "postgres";

interface JudgeJobData {
  submissionId: string;
}

interface SubmissionTestResult {
  testIndex: number;
  passed: boolean;
  details?: string;
}

interface Submission {
  id: string;
  source_code: string;
  language: string;
  problem_id: string;
  verdict: string;
}

interface Problem {
  id: string;
  slug: string;
  time_limit_ms: number;
  memory_limit_kb: number;
}

interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  ordinal: number;
}

/**
 * Get language ID for Judge0 API
 * Language ID mapping (commonly used ones):
 * 1 = C, 2 = C++, 3 = C#, 4 = Clojure, 7 = Ruby, 8 = Bash, 9 = Python (2),
 * 10 = Object-C, 11 = Swift, 12 = Go, 13 = Scala, 14 = Kotlin, 15 = Fortran,
 * 16 = Prolog, 17 = ABAP, 18 = Lua, 19 = Assembly, 20 = Perl, 21 = Java,
 * 22 = C++14, 23 = Lisp, 24 = SQL, 25 = PHP, 26 = Swift, 27 = Rust, 28 = D,
 * 29 = R, 30 = Tcl, 31 = MySQL, 32 = PostgreSQL, 33 = Oracle, 34 = MariaDB,
 * 35 = Prolog, 36 = ALGOL 68, 37 = ACL, 38 = AWK, 39 = BASH, 40 = COBOL,
 * 41 = CVS, 42 = Clojure, 43 = CLISP, 44 = Node.js, 45 = F#, 46 = Forth,
 * 47 = Fortran, 48 = Free Basic, 49 = FreeC, 50 = Gawk, 51 = Gforth, 52 = Golfscript,
 * 53 = Groovy, 54 = Haskell, 55 = Icon, 56 = Intercal, 57 = Io, 58 = Jelly,
 * 59 = Julia, 60 = Kawa, 61 = Lisp, 62 = Logo, 63 = Lua, 64 = Make, 65 = Mumps,
 * 66 = Nim, 67 = OCaml, 68 = Octave, 69 = Oz, 70 = Pascal, 71 = Perl, 72 = PHP,
 * 73 = Pike, 74 = Prolog, 75 = Python (3), 76 = Python (3.10), 77 = Rebol,
 * 78 = Ruby, 79 = Rust, 80 = Sass, 81 = Scala, 82 = Scheme, 83 = Sed, 84 = Smalltalk,
 * 85 = SQL, 86 = Swift, 87 = Tcl, 88 = Typescript, 89 = VB.NET, 90 = Verilog,
 * 91 = VHDL, 92 = Vim, 93 = Wren, 94 = x86 Assembly, 95 = Zsh
 */
function getJudge0LanguageId(language: string): number {
  const languageMap: Record<string, number> = {
    python: 75,
    python3: 75,
    js: 44, // Node.js
    javascript: 44,
    node: 44,
    ts: 88, // Typescript
    typescript: 88,
    cpp: 23, // C++14 is 23, basic C++ is 2
    c: 1,
    java: 21,
    rust: 79,
    go: 12,
    ruby: 78,
    php: 72,
    bash: 39,
    sql: 85,
  };

  const id = languageMap[language.toLowerCase()];
  if (!id) {
    throw new Error(`Unsupported language: ${language}`);
  }

  return id;
}

/**
 * Main judge processor function
 */
export async function judgeProcessor(job: Job<JudgeJobData>) {
  console.log(`[Judge Worker] Processing submission: ${job.data.submissionId}`);

  const DATABASE_URL = process.env.DATABASE_URL || "postgres://clash:clash@localhost:5440/clashofcode";
  const sql = postgres(DATABASE_URL);
  const judge0 = new Judge0Client();

  try {
    // Fetch submission from database
    const submissions = await sql<Submission[]>`
      SELECT id, source_code, language, problem_id, verdict
      FROM submissions
      WHERE id = ${job.data.submissionId}
    `;

    if (!submissions.length) {
      throw new Error(`Submission not found: ${job.data.submissionId}`);
    }

    const submission = submissions[0];

    // Fetch problem details
    const problems = await sql<Problem[]>`
      SELECT id, slug, time_limit_ms, memory_limit_kb
      FROM problems
      WHERE id = ${submission.problem_id}
    `;

    if (!problems.length) {
      throw new Error(`Problem not found for submission: ${job.data.submissionId}`);
    }

    const problem = problems[0];

    // Fetch test cases in order
    const testCases = await sql<TestCase[]>`
      SELECT id, input, expected_output, ordinal
      FROM test_cases
      WHERE problem_id = ${problem.id}
      ORDER BY ordinal ASC
    `;

    console.log(
      `[Judge Worker] Judging submission ${submission.id} for problem ${problem.slug} (${testCases.length} tests)`
    );

    const languageId = getJudge0LanguageId(submission.language);
    const testResults: SubmissionTestResult[] = [];
    let passedCount = 0;
    
    // FIX P4: Track highest-priority verdict instead of collapsing all to "wrong_answer"
    // Priority: Compilation Error > Runtime Error > TLE > MLE > Wrong Answer
    let highestPriorityVerdict: Verdict | null = null;
    const VERDICT_PRIORITY: Record<Verdict, number> = {
      "compilation_error": 5,
      "runtime_error": 4,
      "time_limit_exceeded": 3,
      "memory_limit_exceeded": 2,
      "wrong_answer": 1,
      "accepted": 0, // Lowest priority (not an error)
      "internal_error": 6, // Highest priority
    };

    // Judge each test case
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      try {
        // Submit to Judge0
        const { token } = await judge0.submit({
          language_id: languageId,
          source_code: submission.source_code,
          stdin: testCase.input,
          expected_output: testCase.expected_output,
          cpu_time_limit: Math.ceil(problem.time_limit_ms / 1000), // Judge0 uses seconds, round up
          memory_limit: problem.memory_limit_kb,
        });

        // Poll for result
        const result = await judge0.pollResult(token, 30000, 200);

        // Map verdict
        const verdict = mapJudge0StatusToVerdict(result.status.id, result.stderr, result.compile_output);

        // Track highest priority verdict (P4 fix: don't collapse to wrong_answer)
        if (!highestPriorityVerdict || VERDICT_PRIORITY[verdict] > VERDICT_PRIORITY[highestPriorityVerdict]) {
          highestPriorityVerdict = verdict;
        }

        // For passed verdicts, check output
        let testPassed = false;
        let details = result.status.description;

        if (verdict === "accepted") {
          const comparison = compareOutput(
            testCase.expected_output,
            result.stdout || ""
          );
          testPassed = comparison.passed;
          details = comparison.details.join(", ");
          
          // If output comparison fails, record wrong_answer according to priority
          if (!testPassed) {
            if (!highestPriorityVerdict || VERDICT_PRIORITY["wrong_answer"] > VERDICT_PRIORITY[highestPriorityVerdict]) {
              highestPriorityVerdict = "wrong_answer";
            }
          }
        }

        if (testPassed) {
          passedCount++;
        }

        testResults.push({
          testIndex: i,
          passed: testPassed,
          details,
        });

        console.log(`[Judge Worker] Test ${i + 1}: ${testPassed ? "PASS" : "FAIL"} - ${details} (${verdict})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Judge Worker] Test ${i + 1} error: ${errorMsg}`);
        testResults.push({
          testIndex: i,
          passed: false,
          details: errorMsg,
        });
      }
    }

    // Determine final verdict (FIX P4: use highest priority verdict, not just wrong_answer)
    const finalVerdict: Verdict = passedCount === testCases.length 
      ? "accepted" 
      : (highestPriorityVerdict || "wrong_answer");

    // Update submission in database
    const now = new Date();
    await sql`
      UPDATE submissions
      SET verdict = ${finalVerdict},
          passed_tests = ${passedCount},
          total_tests = ${testCases.length},
          judged_at = ${now}
      WHERE id = ${submission.id}
    `;

    console.log(
      `[Judge Worker] Submission ${submission.id} judged: ${finalVerdict} (${passedCount}/${testCases.length} tests passed)`
    );

    await sql.end();

    return {
      submissionId: submission.id,
      verdict: finalVerdict,
      passedTests: passedCount,
      totalTests: testCases.length,
      testResults,
    };
  } catch (error) {
    console.error(
      `[Judge Worker] Error processing submission ${job.data.submissionId}:`,
      error
    );

    // Retry once on transient failures (FR-4.6)
    if (job.attemptsMade < 1) {
      console.log(`[Judge Worker] Retrying submission ${job.data.submissionId}...`);
      throw error; // BullMQ will retry automatically
    }

    // If we've already retried, mark as internal error
    try {
      const DATABASE_URL = process.env.DATABASE_URL || "postgres://clash:clash@localhost:5440/clashofcode";
      const sql = postgres(DATABASE_URL);
      await sql`
        UPDATE submissions
        SET verdict = 'internal_error',
            judged_at = ${new Date()}
        WHERE id = ${job.data.submissionId}
      `;
      await sql.end();
    } catch (updateError) {
      console.error(`[Judge Worker] Failed to update submission with internal error:`, updateError);
    }

    throw error;
  }
}
