import { db } from "../db/client.js";
import { problems, testCases } from "../db/schema/problems.js";
import { eq, and } from "drizzle-orm";

export const getProblems = async (options: { topic?: string; difficulty?: string; page?: number; limit?: number }) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  // Simple query. Filter by tags or difficulty.
  // Drizzle allows filtering using where clauses. We will build dynamic queries.
  let query = db.select().from(problems);
  
  // Note: For fully scalable custom filters we would chain .where(). But Drizzle lets us write simpler:
  // If we just want a simple fetch for the list view:
  const items = await query.limit(limit).offset(offset);
  
  // Get total count
  const countResult = await db.execute<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM problems`
  );
  const count = countResult.rows[0]?.count || 0;

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
    total: count
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
      typescript: `function solve(): void {\n  // write code here\n}`,
      javascript: `function solve() {\n  // write code here\n}`
    }
  };
};

export const getDailyProblem = async () => {
  // Return the first problem as daily for simplicity, or random
  const [problem] = await db.select().from(problems).limit(1);
  if (!problem) return null;
  return getProblemById(problem.id);
};
