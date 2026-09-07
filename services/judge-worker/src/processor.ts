import { Job } from "bullmq";
import { getDatabase } from "./db.js";
import { Judge0Client } from "./judge0-client.js";
import { compareOutput } from "./output-comparator.js";
import { mapJudge0StatusToVerdict, Verdict } from "./verdict-mapper.js";
import postgres from "postgres";

interface JudgeJobData {
  submissionId: string;
  testMode?: 'sample' | 'full';
}

interface SubmissionTestResult {
  testIndex: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  details?: string;
  stderr?: string;
  compileOutput?: string;
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
  is_sample?: boolean;
}

/**
 * Get language ID for Judge0 API
 * Language ID mapping (commonly used ones):
 * Note: These IDs may vary depending on Judge0 version and configuration
 * Common mappings:
 * - JavaScript (Node.js): 63 or 93 (newer versions)
 * - TypeScript: 74 or 94 (depends on Judge0 version)
 * - Python 3: 71 or 92 (depends on version)
 * 
 * Standard Judge0 CE v1.13.0 mappings:
 * 63 = JavaScript (Node.js 12.14.0)
 * 71 = Python (3.8.1)
 * 74 = TypeScript (3.7.4)
 * 
 * If you're getting internal errors, verify your Judge0 instance language IDs by:
 * curl http://localhost:2358/languages
 */
function getJudge0LanguageId(language: string): number {
  const languageMap: Record<string, number> = {
    python: 71,
    python3: 71,
    js: 63, // Node.js (changed from 44)
    javascript: 63,
    node: 63,
    ts: 74, // TypeScript
    typescript: 74,
    cpp: 54, // C++17 (changed from 23)
    c: 50, // C (GCC 9.2.0)
    java: 62, // Java (OpenJDK 13.0.1)
    rust: 73, // Rust (1.40.0)
    go: 60, // Go (1.13.5)
    ruby: 72, // Ruby (2.7.0)
    php: 68, // PHP (7.4.1)
    bash: 46, // Bash (5.0.0)
    sql: 82, // SQL (SQLite 3.27.2)
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
  console.log(`[Judge Worker] Job data:`, JSON.stringify(job.data, null, 2));

  const DATABASE_URL = process.env.DATABASE_URL || "postgres://clash:clash@localhost:5440/clashofcode";
  const sql = postgres(DATABASE_URL);
  const judge0 = new Judge0Client();

  console.log(`[Judge Worker] Using Judge0 URL: ${process.env.JUDGE0_URL || "http://localhost:2358"}`);

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

    // FIX P0 BUG 8: Filter by is_sample when testMode is 'sample'
    const testMode = job.data.testMode || 'full';
    const testCases = await sql<TestCase[]>`
      SELECT id, input, expected_output, ordinal, is_sample
      FROM test_cases
      WHERE problem_id = ${problem.id}
        ${testMode === 'sample' ? sql`AND is_sample = true` : sql``}
      ORDER BY ordinal ASC
    `;

    console.log(
      `[Judge Worker] Judging submission ${submission.id} for problem ${problem.slug} (${testCases.length} ${testMode} tests)`
    );

    const languageId = getJudge0LanguageId(submission.language);
    console.log(`[Judge Worker] Language: ${submission.language} -> Judge0 ID: ${languageId}`);
    
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

      console.log(`[Judge Worker] Test ${i + 1}/${testCases.length}:`);
      console.log(`  - Input length: ${testCase.input.length} chars`);
      console.log(`  - Expected output length: ${testCase.expected_output.length} chars`);

      try {
        // Submit to Judge0 (note: expected_output is not used by Judge0 for execution)
        const cpuTimeLimit = Math.ceil(problem.time_limit_ms / 1000);
        const { token } = await judge0.submit({
          language_id: languageId,
          source_code: submission.source_code,
          stdin: testCase.input,
          cpu_time_limit: cpuTimeLimit,
          wall_time_limit: cpuTimeLimit * 2, // Wall time should be higher than CPU time
          memory_limit: problem.memory_limit_kb,
        });

        console.log(`[Judge Worker] Test ${i + 1} submitted with token: ${token}`);

        // Poll for result
        const result = await judge0.pollResult(token, 30000, 200);

        console.log(`[Judge Worker] Test ${i + 1} execution complete:`);
        console.log(`  - Status ID: ${result.status.id}`);
        console.log(`  - Status description: ${result.status.description}`);

        // Map verdict
        const verdict = mapJudge0StatusToVerdict(result.status.id, result.stderr, result.compile_output);

        console.log(`[Judge Worker] Test ${i + 1} verdict: ${verdict}`);

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
          
          console.log(`[Judge Worker] Test ${i + 1} output comparison:`);
          console.log(`  - Passed: ${testPassed}`);
          console.log(`  - Details: ${details}`);
          
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
          input: testCase.input,
          expectedOutput: testCase.expected_output,
          actualOutput: result.stdout || "",
          details,
          stderr: result.stderr || undefined,
          compileOutput: result.compile_output || undefined,
        });

        console.log(`Test ${i + 1}: ${testPassed ? "PASS" : "FAIL"} - ${details} (${verdict})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Judge Worker] Test ${i + 1} error: ${errorMsg}`);
        testResults.push({
          testIndex: i,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.expected_output,
          actualOutput: "",
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
          test_results = ${JSON.stringify(testResults)}::jsonb,
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
