/**
 * Match completion service - finalizes matches and calculates rating updates
 */

import { pool } from "../db/client.js";
import { computeMatchRatings } from "@clashofcode/shared";

export interface MatchCompletionResult {
  success: boolean;
  matchId: string;
  winnerId?: string;
  ratingChanges?: {
    playerOne: { before: number; after: number; delta: number };
    playerTwo?: { before: number; after: number; delta: number };
  };
  error?: string;
}

/**
 * Determines the winner based on submissions
 * Priority: First to AC > Most tests passed > First submission
 */
export async function determineWinner(
  matchId: string,
  playerOneId: string,
  playerTwoId: string
): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT user_id, verdict, passed_tests, total_tests, created_at
       FROM submissions
       WHERE match_id = $1 AND user_id IN ($2, $3)
       ORDER BY 
         CASE WHEN verdict = 'accepted' THEN 0 ELSE 1 END,
         passed_tests DESC,
         created_at ASC`,
      [matchId, playerOneId, playerTwoId]
    );

    if (result.rows.length === 0) {
      return null; // No submissions - draw or forfeit handled elsewhere
    }

    // Check if someone got AC
    const acSubmission = result.rows.find((s: any) => s.verdict === "accepted");
    if (acSubmission) {
      return acSubmission.user_id;
    }

    // Check best submission by tests passed
    const bestSubmission = result.rows[0];
    if (!bestSubmission) {
      return null;
    }

    // If both players have submissions, compare them
    const playerOneBest = result.rows.find((s: any) => s.user_id === playerOneId);
    const playerTwoBest = result.rows.find((s: any) => s.user_id === playerTwoId);

    if (!playerOneBest) return playerTwoId;
    if (!playerTwoBest) return playerOneId;

    // Compare passed tests
    if (playerOneBest.passed_tests > playerTwoBest.passed_tests) {
      return playerOneId;
    } else if (playerTwoBest.passed_tests > playerOneBest.passed_tests) {
      return playerTwoId;
    }

    // If tied on tests, first submission wins
    const playerOneTime = new Date(playerOneBest.created_at).getTime();
    const playerTwoTime = new Date(playerTwoBest.created_at).getTime();

    return playerOneTime < playerTwoTime ? playerOneId : playerTwoId;
  } catch (err) {
    console.error("[Match Completion] Error determining winner:", err);
    return null;
  }
}

/**
 * Complete a match and trigger rating calculation
 */
export async function completeMatch(
  matchId: string,
  playerOneId: string,
  playerTwoId: string | null
): Promise<MatchCompletionResult> {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    console.log(`[Match Completion] Completing match ${matchId}...`);

    // Determine winner
    const winnerId = playerTwoId 
      ? await determineWinner(matchId, playerOneId, playerTwoId)
      : null;

    // Update match record
    await client.query(
      `UPDATE matches 
       SET status = 'completed', 
           winner_id = $1, 
           ended_at = NOW() 
       WHERE id = $2`,
      [winnerId, matchId]
    );

    // Only calculate ratings for ranked matches with two players
    if (!playerTwoId) {
      await client.query("COMMIT");
      console.log(`[Match Completion] ✅ Match ${matchId} completed (solo/practice mode)`);
      return {
        success: true,
        matchId,
        winnerId: winnerId || undefined,
      };
    }

    // Fetch player ratings
    const usersRes = await client.query(
      `SELECT id, rating, rating_deviation, rating_volatility, games_played, wins, losses 
       FROM users WHERE id IN ($1, $2)`,
      [playerOneId, playerTwoId]
    );

    const playerOne = usersRes.rows.find((u: any) => u.id === playerOneId);
    const playerTwo = usersRes.rows.find((u: any) => u.id === playerTwoId);

    if (!playerOne || !playerTwo) {
      throw new Error("Could not find player records");
    }

    // Calculate rating changes using Glicko-2
    const outcome = winnerId === playerOneId ? "player_one" : winnerId === playerTwoId ? "player_two" : "draw";
    
    const ratingResult = computeMatchRatings(
      {
        rating: playerOne.rating,
        deviation: playerOne.rating_deviation,
        volatility: playerOne.rating_volatility,
      },
      {
        rating: playerTwo.rating,
        deviation: playerTwo.rating_deviation,
        volatility: playerTwo.rating_volatility,
      },
      outcome
    );

    const playerOneDelta = ratingResult.playerOne.rating - playerOne.rating;
    const playerTwoDelta = ratingResult.playerTwo.rating - playerTwo.rating;

    // Update player one stats
    await client.query(
      `UPDATE users 
       SET rating = $1, 
           rating_deviation = $2, 
           rating_volatility = $3,
           games_played = games_played + 1,
           wins = wins + CASE WHEN $4 = $5 THEN 1 ELSE 0 END,
           losses = losses + CASE WHEN $4 != $5 AND $4 IS NOT NULL THEN 1 ELSE 0 END,
           draws = draws + CASE WHEN $4 IS NULL THEN 1 ELSE 0 END,
           updated_at = NOW()
       WHERE id = $5`,
      [
        ratingResult.playerOne.rating,
        ratingResult.playerOne.deviation,
        ratingResult.playerOne.volatility,
        winnerId,
        playerOneId,
      ]
    );

    // Update player two stats
    await client.query(
      `UPDATE users 
       SET rating = $1, 
           rating_deviation = $2, 
           rating_volatility = $3,
           games_played = games_played + 1,
           wins = wins + CASE WHEN $4 = $5 THEN 1 ELSE 0 END,
           losses = losses + CASE WHEN $4 != $5 AND $4 IS NOT NULL THEN 1 ELSE 0 END,
           draws = draws + CASE WHEN $4 IS NULL THEN 1 ELSE 0 END,
           updated_at = NOW()
       WHERE id = $5`,
      [
        ratingResult.playerTwo.rating,
        ratingResult.playerTwo.deviation,
        ratingResult.playerTwo.volatility,
        winnerId,
        playerTwoId,
      ]
    );

    // Insert rating history
    await client.query(
      `INSERT INTO ratings_history (user_id, match_id, rating_before, rating_after, rd_before, rd_after, vol_before, vol_after, delta, created_at)
       VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()),
       ($10, $2, $11, $12, $13, $14, $15, $16, $17, NOW())`,
      [
        playerOneId,
        matchId,
        playerOne.rating,
        ratingResult.playerOne.rating,
        playerOne.rating_deviation,
        ratingResult.playerOne.deviation,
        playerOne.rating_volatility,
        ratingResult.playerOne.volatility,
        playerOneDelta,
        playerTwoId,
        playerTwo.rating,
        ratingResult.playerTwo.rating,
        playerTwo.rating_deviation,
        ratingResult.playerTwo.deviation,
        playerTwo.rating_volatility,
        ratingResult.playerTwo.volatility,
        playerTwoDelta,
      ]
    );

    await client.query("COMMIT");

    console.log(
      `[Match Completion] ✅ Match ${matchId} completed. Winner: ${winnerId || "Draw"}. Rating changes: P1 ${playerOneDelta >= 0 ? "+" : ""}${Math.round(playerOneDelta)}, P2 ${playerTwoDelta >= 0 ? "+" : ""}${Math.round(playerTwoDelta)}`
    );

    return {
      success: true,
      matchId,
      winnerId: winnerId || undefined,
      ratingChanges: {
        playerOne: {
          before: Math.round(playerOne.rating),
          after: Math.round(ratingResult.playerOne.rating),
          delta: Math.round(playerOneDelta),
        },
        playerTwo: {
          before: Math.round(playerTwo.rating),
          after: Math.round(ratingResult.playerTwo.rating),
          delta: Math.round(playerTwoDelta),
        },
      },
    };
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(`[Match Completion] ❌ Error completing match ${matchId}:`, err);
    return {
      success: false,
      matchId,
      error: err.message || "Unknown error",
    };
  } finally {
    client.release();
  }
}
