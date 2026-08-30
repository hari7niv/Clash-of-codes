import { db } from "../db/client.js";
import { problems, testCases } from "../db/schema/problems.js";
import { eq, and, sql } from "drizzle-orm";

export const getProblems = async (options: { topic?: string; difficulty?: string; page?: number; limit?: number }) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  // Build dynamic conditions
  const conditions = [] as any[];
  if (options.difficulty) {
    conditions.push(eq(problems.difficulty, options.difficulty.toLowerCase()));
  }
  if (options.topic) {
    // Assuming tags is an array column; use PostgreSQL array contains operator
    conditions.push(sql`${problems.tags} @> ARRAY[${options.topic}]`);
  }

  // Base query
  let query = db.select().from(problems);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  // Fetch paginated items
  const items = await query.limit(limit).offset(offset);

  // Count total with same filters
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(problems)
    .where(and(...conditions))
    .limit(1);
  const total = countResult[0]?.count ?? 0;

  return {
    items: items.map(p => ({
      id: p.id,
      title: p.title,
      topic: p.tags[0] || "Random",
      difficulty: p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1) as any,
      points: p.rating
    })),
    page,
    limit,
    total
  };
};

export const getProblemById = async (id: string) => {
  const [problem] = await db.select().from(problems).where(eq(problems.id, id));
  if (!problem) return null;

  const publicTestcases = await db
    .select()
    .from(testCases)
    .where(and(eq(testCases.problemId, id), eq(testCases.isSample, true)));

  return {
    id: problem.id,
    title: problem.title,
    topic: problem.tags[0] || "Random",
    difficulty: problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1) as any,
    points: problem.rating,
    statement: problem.statement,
    constraints: [
      `Time limit: ${problem.timeLimitMs}ms`,
      `Memory limit: ${Math.round(problem.memoryLimitKb / 1024)}MB`
    ],
    examples: publicTestcases.map(tc => ({
      input: tc.input,
      output: tc.expectedOutput
    })),
    starterCode: {
      python: `def solve():\n    # write code here\n    pass`,
      java: `public class Solution {\n    public static void solve() {\n        // write code here\n    }\n}`,
      cpp: `#include <iostream>\nusing namespace std;\n\nvoid solve() {\n    // write code here\n}`,
      javascript: `function solve() {\n  // write code here\n}`,
      typescript: `function solve(): void {\n  // write code here\n}`
    }
  };
};

export const getDailyProblem = async () => {
  const allProblems = await db.select().from(problems);
  if (allProblems.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const problem = allProblems[dayIndex % allProblems.length];
  return getProblemById(problem.id);
};
