/**
 * Match completion service - finalizes matches and calculates rating updates
 * FIX P0 BUG 5 + 6: Single authoritative match completion with idempotency
 */

import { pool } from "../db/client.js";
import { computeMatchRatings } from "@clashofcode/shared";

export type MatchCompletionReason =
  | "forfeit"
  | "accepted_solution"
  | "time_expired"
  | "manual"
  | "abandoned";

export interface CompleteMatchOptions {
  matchId: string;
  reason: MatchCompletionReason;
  forcedWinnerId?: string | null; // For forfeit: opponent must win
}

export interface MatchCompletionResult {
  success: boolean;
  matchId: string;
  winnerId?: string;
  reason: MatchCompletionReason;
  ratingChanges?: {
    playerOne: { before: number; after: number; delta: number };
    playerTwo?: { before: number; after: number; delta: number };
  };
  error?: string;
}

/**
 * Determines the winner based on submissions
 * Priority: First to AC > Most tests passed > First submission
 * CRITICAL: Only considers competitive submissions (excludes test runs)
 */
async function determineWinner(
  matchId: string,
  playerOneId: string,
  playerTwoId: string,
  client: any // pg client for transaction consistency
): Promise<string | null> {
  try {
    // FIX CRITICAL BUG: Only consider competitive submissions for winner determination
    const result = await client.query(
      `SELECT user_id, verdict, passed_tests, total_tests, created_at
       FROM submissions
       WHERE match_id = $1 
         AND user_id IN ($2, $3)
         AND submission_type = 'competitive'
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
 * FIX P0 BUG 5 + 6: Single authoritative match completion
 * Idempotent operation - can be called multiple times safely
 * Handles: forfeit, accepted solution, time expiry, manual completion
 */
export async function completeMatch(
  options: CompleteMatchOptions
): Promise<MatchCompletionResult> {
  const { matchId, reason, forcedWinnerId } = options;
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    console.log(`[Match Completion] Completing match ${matchId} (reason: ${reason})...`);

    // Check if already completed (idempotency)
    const matchCheck = await client.query(
      "SELECT id, status, winner_id, player_one_id, player_two_id FROM matches WHERE id = $1 FOR UPDATE",
      [matchId]
    );

    if (matchCheck.rows.length === 0) {
      throw new Error("Match not found");
    }

    const match = matchCheck.rows[0];
    
    // If already completed, return existing result
    if (match.status === "completed") {
      console.log(`[Match Completion] Match ${matchId} already completed with winner ${match.winner_id}`);
      await client.query("COMMIT");
      
      // Fetch existing rating history
      const historyRes = await pool.query(
        `SELECT user_id, rating_before, rating_after, delta 
         FROM ratings_history 
         WHERE match_id = $1 
         ORDER BY user_id`,
        [matchId]
      );

      const ratingChanges: any = {};
      if (historyRes.rows.length >= 1) {
        const p1 = historyRes.rows.find((r: any) => r.user_id === match.player_one_id);
        if (p1) {
          ratingChanges.playerOne = {
            before: Math.round(p1.rating_before),
            after: Math.round(p1.rating_after),
            delta: Math.round(p1.delta),
          };
        }
      }
      if (historyRes.rows.length >= 2 && match.player_two_id) {
        const p2 = historyRes.rows.find((r: any) => r.user_id === match.player_two_id);
        if (p2) {
          ratingChanges.playerTwo = {
            before: Math.round(p2.rating_before),
            after: Math.round(p2.rating_after),
            delta: Math.round(p2.delta),
          };
        }
      }

      return {
        success: true,
        matchId,
        winnerId: match.winner_id || undefined,
        reason,
        ratingChanges: Object.keys(ratingChanges).length > 0 ? ratingChanges : undefined,
      };
    }

    const playerOneId = match.player_one_id;
    const playerTwoId = match.player_two_id;

    // Determine winner based on completion reason
    let winnerId: string | null = null;

    if (reason === "forfeit") {
      // FIX P0 BUG 6: For forfeit, forcedWinnerId MUST be honored
      if (!forcedWinnerId) {
        throw new Error("forcedWinnerId is required for forfeit completion");
      }
      winnerId = forcedWinnerId;
      console.log(`[Match Completion] Forfeit: Winner set to ${winnerId}`);
    } else if (reason === "accepted_solution" || reason === "time_expired") {
      // Determine winner from submissions
      winnerId = playerTwoId 
        ? await determineWinner(matchId, playerOneId, playerTwoId, client)
        : null;
      console.log(`[Match Completion] ${reason}: Winner determined as ${winnerId || "draw"}`);
    } else if (reason === "manual" || reason === "abandoned") {
      // For manual/abandoned, use forcedWinnerId if provided, otherwise determine from submissions
      winnerId = forcedWinnerId !== undefined 
        ? forcedWinnerId 
        : (playerTwoId ? await determineWinner(matchId, playerOneId, playerTwoId, client) : null);
      console.log(`[Match Completion] ${reason}: Winner is ${winnerId || "draw"}`);
    }

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
      console.log(`[Match Completion] ✅ Match ${matchId} completed (solo/practice mode, no ratings)`);
      return {
        success: true,
        matchId,
        winnerId: winnerId || undefined,
        reason,
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
      `[Match Completion] ✅ Match ${matchId} completed (${reason}). Winner: ${winnerId || "Draw"}. Rating changes: P1 ${playerOneDelta >= 0 ? "+" : ""}${Math.round(playerOneDelta)}, P2 ${playerTwoDelta >= 0 ? "+" : ""}${Math.round(playerTwoDelta)}`
    );

    return {
      success: true,
      matchId,
      winnerId: winnerId || undefined,
      reason,
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
      reason,
      error: err.message || "Unknown error",
    };
  } finally {
    client.release();
  }
}
