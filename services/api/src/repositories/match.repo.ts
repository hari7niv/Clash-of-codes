import { db } from "../db/client.js";
import { matches, submissions, ratingsHistory } from "../db/schema/matches.js";
import { problems } from "../db/schema/problems.js";
import { users } from "../db/schema/users.js";
import { eq, and } from "drizzle-orm";

export const getMatchById = async (matchId: string) => {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) return null;

  const [problem] = await db.select().from(problems).where(eq(problems.id, match.problemId));
  const opponentId = match.playerTwoId; // Simplification (assuming client is playerOne)
  const [opponent] = opponentId 
    ? await db.select().from(users).where(eq(users.id, opponentId))
    : [null];

  return {
    match,
    problem,
    opponent,
  };
};

export const createSubmission = async (data: {
  matchId: string;
  userId: string;
  problemId: string;
  language: string;
  sourceCode: string;
  verdict: string;
  passedTests: number;
  totalTests: number;
}) => {
  const [newSubmission] = await db.insert(submissions).values({
    matchId: data.matchId,
    userId: data.userId,
    problemId: data.problemId,
    language: data.language,
    sourceCode: data.sourceCode,
    verdict: data.verdict,
    passedTests: data.passedTests,
    totalTests: data.totalTests,
  }).returning();

  return newSubmission;
};

export const getMatchResult = async (matchId: string, userId: string) => {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) return null;

  const [ratingHist] = await db
    .select()
    .from(ratingsHistory)
    .where(and(eq(ratingsHistory.matchId, matchId), eq(ratingsHistory.userId, userId)));

  const isWinner = match.winnerId === userId;
  const ratingDelta = ratingHist ? ratingHist.delta : 0;

  return {
    outcome: isWinner ? "VICTORY" as const : "DEFEAT" as const,
    matchCode: `#${match.id.substring(0, 4).toUpperCase()}`,
    summaryLine: isWinner ? "You found the window faster." : "Your opponent solved it faster.",
    ratingChange: Math.round(ratingDelta),
    newRating: ratingHist ? Math.round(ratingHist.ratingAfter) : 1500,
    xpEarned: isWinner ? 150 : 50,
    xp: 250,
    xpGoal: 1000,
    winStreak: isWinner ? 1 : 0,
    bestStreak: 1,
    comparison: [
      { label: "Submissions", you: "1", opponent: "1", better: isWinner }
    ],
    whatWentWell: isWinner ? ["Optimized complexity"] : ["Completed the solution"],
    improveNext: isWinner ? ["Code execution speed"] : ["Optimize traversal path"],
    scoreboard: { durationLabel: "5m", efficiency: 100, testsPassed: "10/10" },
    levelProgressPct: 25
  };
};
