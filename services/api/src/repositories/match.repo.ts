import { db } from "../db/client.js";
import { matches, submissions, ratingsHistory } from "../db/schema/matches.js";
import { problems } from "../db/schema/problems.js";
import { users } from "../db/schema/users.js";
import { eq, and, sql } from "drizzle-orm";

export const getMatchById = async (matchId: string, currentUserId?: string) => {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) return null;

  const [problem] = await db.select().from(problems).where(eq(problems.id, match.problemId));
  
  let opponents: any[] = [];
  
  if (match.mode === "room" && match.roomCode) {
    // For room matches, fetch all other members of the room
    const members = await db.execute(
      sql`SELECT u.id, u.username, u.rating, u.games_played, u.wins, u.losses, u.draws 
          FROM room_members rm 
          JOIN users u ON rm.user_id = u.id 
          WHERE rm.room_id = (SELECT id FROM rooms WHERE code = ${match.roomCode})
          AND rm.user_id != ${currentUserId || ''}`
    );
    opponents = members.rows.map((m: any) => ({
      id: m.id,
      handle: m.username,
      initials: m.username.substring(0, 2).toUpperCase(),
      rating: Math.round(m.rating),
      gamesPlayed: m.games_played ?? 0,
      wins: m.wins ?? 0,
      losses: m.losses ?? 0,
      draws: m.draws ?? 0,
    }));
  } else {
    // Dynamically select the opponent depending on who is requesting the data
    let opponentId = match.playerTwoId;
    if (currentUserId && match.playerTwoId === currentUserId) {
      opponentId = match.playerOneId;
    }
    if (opponentId) {
      const [opp] = await db.select().from(users).where(eq(users.id, opponentId));
      if (opp) opponents.push({
        id: opp.id,
        handle: opp.username,
        initials: opp.username.substring(0, 2).toUpperCase(),
        rating: Math.round(opp.rating),
        gamesPlayed: opp.gamesPlayed ?? 0,
        wins: opp.wins ?? 0,
        losses: opp.losses ?? 0,
        draws: opp.draws ?? 0,
      });
    }
  }

  return {
    match,
    problem,
    opponents,
  };
};

export const createSubmission = async (data: {
  matchId: string | null;
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

export const getSubmissionById = async (submissionId: string) => {
  const [submission] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  return submission || null;
};

export const getMatchResult = async (matchId: string, userId: string) => {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) return null;

  const [ratingHist] = await db
    .select()
    .from(ratingsHistory)
    .where(and(eq(ratingsHistory.matchId, matchId), eq(ratingsHistory.userId, userId)));

  const isWinner = match.winnerId === userId;
  const isDraw = match.winnerId === null && match.status === "completed";
  const ratingDelta = ratingHist ? ratingHist.delta : 0;

  const outcome = isWinner ? "VICTORY" as const : (isDraw ? "DRAW" as const : "DEFEAT" as const);
  const summaryLine = isWinner 
    ? "You found the window faster." 
    : (isDraw ? "Both players finished with similar scores." : "Your opponent solved it faster.");

  return {
    outcome,
    matchCode: `#${match.id.substring(0, 4).toUpperCase()}`,
    summaryLine,
    ratingChange: Math.round(ratingDelta),
    newRating: ratingHist ? Math.round(ratingHist.ratingAfter) : 1500,
    xpEarned: isWinner ? 150 : (isDraw ? 100 : 50),
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
