/**
 * Submission + verdict types, plus the BullMQ job contract.
 *
 * `JudgeJobData` / `JudgeJobResult` are the wire format between the producers
 * (api for practice, match-server for battles) and the judge-worker consumer.
 */

export const VERDICTS = [
  'pending',
  'accepted',
  'wrong_answer',
  'time_limit_exceeded',
  'memory_limit_exceeded',
  'runtime_error',
  'compilation_error',
  'internal_error',
] as const;

export type Verdict = (typeof VERDICTS)[number];

export interface Submission {
  id: string;
  /** null for practice submissions that aren't tied to a live match. */
  matchId: string | null;
  userId: string;
  problemId: string;
  language: string;
  sourceCode: string;
  verdict: Verdict;
  passedTests: number;
  totalTests: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  createdAt: string;
  judgedAt: string | null;
}

/** Payload enqueued onto the BullMQ judge queue. */
export interface JudgeJobData {
  submissionId: string;
  problemId: string;
  /** Language key (see LANGUAGES in schemas/submission.schema). */
  language: string;
  /** Judge0 language id, derived server-side — never trusted from the client. */
  languageId: number;
  sourceCode: string;
  userId: string;
  /** Match context so match-server can correlate a result back to a room. */
  matchId: string | null;
  roomId: string | null;
}

/** Result returned by the judge-worker when a job resolves. */
export interface JudgeJobResult {
  submissionId: string;
  verdict: Verdict;
  passedTests: number;
  totalTests: number;
  runtimeMs: number | null;
  memoryKb: number | null;
}
