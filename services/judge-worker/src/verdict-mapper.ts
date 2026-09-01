/**
 * Map Judge0 status codes to ClashOfCode verdict strings
 * 
 * Judge0 status codes:
 * 1: In Queue
 * 2: Processing
 * 3: Accepted
 * 4: Wrong Answer
 * 5: Time Limit Exceeded
 * 6: Compilation Error
 * 7-12: Runtime Error (various signals)
 * 13: Internal Error
 * 14: Exec Format Error
 */

export type Verdict = 
  | "accepted"
  | "wrong_answer"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "runtime_error"
  | "compilation_error"
  | "internal_error";

export function mapJudge0StatusToVerdict(statusId: number, stderr?: string, compileOutput?: string): Verdict {
  switch (statusId) {
    case 3:
      return "accepted";

    case 4:
      return "wrong_answer";

    case 5:
      return "time_limit_exceeded";

    case 6:
      return "compilation_error";

    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 14:
      return "runtime_error";

    case 13:
      return "internal_error";

    case 1:
    case 2:
      // Should not happen if we wait for result properly
      return "internal_error";

    default:
      return "internal_error";
  }
}

/**
 * Get human-readable description of verdict
 */
export function getVerdictDescription(verdict: Verdict): string {
  const descriptions: Record<Verdict, string> = {
    accepted: "Accepted",
    wrong_answer: "Wrong Answer",
    time_limit_exceeded: "Time Limit Exceeded",
    memory_limit_exceeded: "Memory Limit Exceeded",
    runtime_error: "Runtime Error",
    compilation_error: "Compilation Error",
    internal_error: "Internal Error",
  };

  return descriptions[verdict];
}

/**
 * Check if verdict is an error (non-accepted verdict)
 */
export function isErrorVerdict(verdict: Verdict): boolean {
  return verdict !== "accepted";
}
