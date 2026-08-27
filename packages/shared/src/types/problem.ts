/** Problem domain types. */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TestCase {
  id: string;
  problemId: string;
  input: string;
  expectedOutput: string;
  /** Sample tests are shown to the client; hidden ones never leave the judge/DB. */
  isSample: boolean;
  ordinal: number;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  statement: string;
  difficulty: Difficulty;
  /** Problem rating on the same scale as player rating, for matchmaking selection. */
  rating: number;
  timeLimitMs: number;
  memoryLimitKb: number;
  tags: string[];
  createdAt: string;
}

/**
 * What a client is allowed to see during a battle. Crucially this omits hidden
 * test cases — only sample I/O is included.
 */
export interface PublicProblem {
  id: string;
  slug: string;
  title: string;
  statement: string;
  difficulty: Difficulty;
  timeLimitMs: number;
  memoryLimitKb: number;
  tags: string[];
  sampleTests: Array<Pick<TestCase, 'input' | 'expectedOutput'>>;
}
