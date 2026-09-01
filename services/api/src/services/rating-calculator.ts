import { computeMatchRatings } from "@clashofcode/shared";
import { db, pool } from "../db/client.js";
import { users, users as usersTable } from "../db/schema/users.js";
import { matches, submissions, ratingsHistory } from "../db/schema/matches.js";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as usersSchema from "../db/schema/users.js";
import * as problemsSchema from "../db/schema/problems.js";
import * as matchesSchema from "../db/schema/matches.js";

// FIX P3.5: Wrap completeMatch in a Drizzle transaction for atomic updates
export const completeMatch = async (matchId: string) => {
  // Get a dedicated connection for this transaction
  const connection = await pool.connect();
  const txDb = drizzle(connection, {
    schema: { ...usersSchema, ...problemsSchema, ...matchesSchema }
  });

  try {
    // Start transaction
    const result = await txDb.transaction(async (tx) => {
      return await completMatchInternal(matchId, tx as any);
    });
    return result;
  } finally {
    connection.release();
  }
};

// Internal function to execute within transaction
const completMatchInternal = async (matchId: string, tx: any) => {
  // Fetch match data
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) {
    throw new Error("Match not found");
  }

  if (match.status === "completed") {
    return match;
  }

  // Fetch all submissions for this match
  const matchSubmissions = await tx
    .select()
    .from(submissions)
    .where(eq(submissions.matchId, matchId));

  // Group submissions by user
  const player1Submissions = matchSubmissions.filter(s => s.userId === match.playerOneId);
  const player2Submissions = matchSubmissions.filter(s => s.userId === match.playerTwoId);

  // Determine verdict for each player (take last submission or best result)
  const player1Verdict = player1Submissions.length > 0
    ? player1Submissions[player1Submissions.length - 1].verdict
    : "abandoned";
  const player2Verdict = player2Submissions.length > 0
    ? player2Submissions[player2Submissions.length - 1].verdict
    : "abandoned";

  // Determine winner
  let winnerId: string | null = null;
  let outcome: "player_one" | "player_two" | "draw" = "draw";

  if (player1Verdict === "accepted" && player2Verdict !== "accepted") {
    winnerId = match.playerOneId;
    outcome = "player_one";
  } else if (player2Verdict === "accepted" && player1Verdict !== "accepted") {
    winnerId = match.playerTwoId;
    outcome = "player_two";
  } else if (player1Verdict === "accepted" && player2Verdict === "accepted") {
    // Both solved - compare submission times
    const player1Time = player1Submissions[player1Submissions.length - 1].createdAt;
    const player2Time = player2Submissions[player2Submissions.length - 1].createdAt;
    if (player1Time && player2Time && player1Time < player2Time) {
      winnerId = match.playerOneId;
      outcome = "player_one";
    } else if (player1Time && player2Time && player2Time < player1Time) {
      winnerId = match.playerTwoId;
      outcome = "player_two";
    }
    // If times are equal, it's a draw
  }

  // Fetch player data
  const [player1] = await tx.select().from(users).where(eq(users.id, match.playerOneId));

  if (!player1) {
    throw new Error("Player 1 not found");
  }

  // Handle single player match (vs practice/AI)
  if (!match.playerTwoId) {
    // Update match status
    await tx
      .update(matches)
      .set({
        status: "completed",
        winnerId: winnerId || undefined,
        endedAt: new Date(),
      })
      .where(eq(matches.id, matchId));

    // Update player in database
    await tx
      .update(users)
      .set({
        gamesPlayed: player1.gamesPlayed + 1,
        wins: player1.wins + (outcome === "player_one" ? 1 : 0),
        losses: player1.losses + (outcome === "player_two" ? 1 : 0),
        draws: player1.draws + (outcome === "draw" ? 1 : 0),
      })
      .where(eq(users.id, match.playerOneId));

    return match;
  }

  // Two player match
  const [player2] = await tx.select().from(users).where(eq(users.id, match.playerTwoId));

  if (!player2) {
    throw new Error("Player 2 not found");
  }

  // Calculate new ratings using Glicko-2
  const ratingResult = computeMatchRatings(
    {
      rating: player1.rating,
      deviation: player1.ratingDeviation,
      volatility: player1.ratingVolatility,
    },
    {
      rating: player2.rating,
      deviation: player2.ratingDeviation,
      volatility: player2.ratingVolatility,
    },
    outcome
  );

  // Update match status
  await tx
    .update(matches)
    .set({
      status: "completed",
      winnerId: winnerId || undefined,
      endedAt: new Date(),
    })
    .where(eq(matches.id, matchId));

  // Update players in database
  await tx
    .update(users)
    .set({
      rating: ratingResult.playerOne.rating,
      ratingDeviation: ratingResult.playerOne.deviation,
      ratingVolatility: ratingResult.playerOne.volatility,
      gamesPlayed: player1.gamesPlayed + 1,
      wins: player1.wins + (outcome === "player_one" ? 1 : 0),
      losses: player1.losses + (outcome === "player_two" ? 1 : 0),
      draws: player1.draws + (outcome === "draw" ? 1 : 0),
    })
    .where(eq(users.id, match.playerOneId));

  await tx
    .update(users)
    .set({
      rating: ratingResult.playerTwo.rating,
      ratingDeviation: ratingResult.playerTwo.deviation,
      ratingVolatility: ratingResult.playerTwo.volatility,
      gamesPlayed: player2.gamesPlayed + 1,
      wins: player2.wins + (outcome === "player_two" ? 1 : 0),
      losses: player2.losses + (outcome === "player_one" ? 1 : 0),
      draws: player2.draws + (outcome === "draw" ? 1 : 0),
    })
    .where(eq(users.id, match.playerTwoId));

  // Record rating changes in history
  await tx.insert(ratingsHistory).values([
    {
      userId: match.playerOneId,
      matchId,
      ratingBefore: player1.rating,
      ratingAfter: ratingResult.playerOne.rating,
      rdBefore: player1.ratingDeviation,
      rdAfter: ratingResult.playerOne.deviation,
      volBefore: player1.ratingVolatility,
      volAfter: ratingResult.playerOne.volatility,
      delta: ratingResult.playerOne.rating - player1.rating,
    },
    {
      userId: match.playerTwoId,
      matchId,
      ratingBefore: player2.rating,
      ratingAfter: ratingResult.playerTwo.rating,
      rdBefore: player2.ratingDeviation,
      rdAfter: ratingResult.playerTwo.deviation,
      volBefore: player2.ratingVolatility,
      volAfter: ratingResult.playerTwo.volatility,
      delta: ratingResult.playerTwo.rating - player2.rating,
    },
  ]);

  // Return updated match
  const [updatedMatch] = await db.select().from(matches).where(eq(matches.id, matchId));
  return updatedMatch;
};
