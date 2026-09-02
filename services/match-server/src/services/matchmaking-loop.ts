/**
 * Matchmaking loop: Periodically finds rating-compatible pairs in the queue
 * and creates matches for them.
 *
 * Algorithm:
 * 1. Fetch all queued players from Redis sorted set (sorted by rating)
 * 2. For each unmatched player, expand rating window: ±50 → ±100 → ±200
 * 3. When pair found, create match and remove both from queue
 * 4. Emit match_found events to both players via Socket.io
 */

import { Redis } from "ioredis";
import type { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db/client.js";
import type { MatchHandler } from "./match-handler.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, MatchFoundPayload, PublicProblem, PublicUser } from "@clashofcode/shared";
import { SOCKET_EVENTS } from "@clashofcode/shared";

const QUEUE_LOOP_INTERVAL_MS = 2_000; // Check queue every 2 seconds
const RATING_WINDOWS = [50, 100, 200]; // Expanding windows for pairing

interface QueuedPlayer {
  userId: string;
  rating: number;
  socketId: string;
  enqueuedAt: number;
  mode: "ranked" | "casual";
}

/**
 * Start the matchmaking loop that periodically finds pairs
 */
export async function startMatchmakingLoop(
  redis: Redis,
  io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  matchHandler: MatchHandler
): Promise<() => void> {
  const intervalId = setInterval(async () => {
    try {
      await runMatchmakingCycle(redis, io, matchHandler, "ranked");
      await runMatchmakingCycle(redis, io, matchHandler, "casual");
    } catch (err) {
      console.error("[Matchmaking] Error in loop:", err);
    }
  }, QUEUE_LOOP_INTERVAL_MS);

  // Return cleanup function
  return () => clearInterval(intervalId);
}

/**
 * Run one cycle of matchmaking for a specific mode
 */
async function runMatchmakingCycle(
  redis: Redis,
  io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  matchHandler: MatchHandler,
  mode: "ranked" | "casual"
): Promise<void> {
  const queueKey = `queue:${mode}`;

  // Get all queued players (Redis sorted set: score = rating, member = userId)
  const queuedMemberScores = await redis.zrange(queueKey, 0, -1, "WITHSCORES");

  // Convert to array of {userId, rating}
  const queuedPlayers: QueuedPlayer[] = [];
  for (let i = 0; i < queuedMemberScores.length; i += 2) {
    const userId = queuedMemberScores[i];
    const rating = parseInt(queuedMemberScores[i + 1], 10);

    // Get socket ID and enqueue time from Redis hashes
    const socketId = await redis.hget(`user:${userId}:queue`, "socketId");
    const enqueuedAtStr = await redis.hget(`user:${userId}:queue`, "enqueuedAt");

    if (socketId && enqueuedAtStr) {
      queuedPlayers.push({
        userId,
        rating,
        socketId,
        enqueuedAt: parseInt(enqueuedAtStr, 10),
        mode,
      });
    }
  }

  // Try to pair players
  const matched = new Set<string>();

  for (let i = 0; i < queuedPlayers.length; i++) {
    if (matched.has(queuedPlayers[i].userId)) continue;

    const player1 = queuedPlayers[i];

    // Try expanding rating windows
    for (const window of RATING_WINDOWS) {
      const candidates = queuedPlayers.filter(
        (p) =>
          !matched.has(p.userId) &&
          p.userId !== player1.userId &&
          Math.abs(p.rating - player1.rating) <= window &&
          p.mode === mode &&
          p.enqueuedAt < Date.now() - 1_000 // Wait at least 1 second for both to enqueue
      );

      if (candidates.length > 0) {
        // Pick the candidate with closest rating
        const player2 = candidates.reduce((closest, candidate) =>
          Math.abs(candidate.rating - player1.rating) <
          Math.abs(closest.rating - player1.rating)
            ? candidate
            : closest
        );

        // Create match IDs
        const roomId = uuidv4();
        const matchId = uuidv4();

        try {
          // Fetch full user data for both players
          const result = await pool.query(
            "SELECT id, username, rating, games_played, wins, losses, draws FROM users WHERE id = ANY($1::uuid[])",
            [[player1.userId, player2.userId]]
          );

          const users = result.rows;
          const user1Row = users.find((u: any) => u.id === player1.userId);
          const user2Row = users.find((u: any) => u.id === player2.userId);

          if (!user1Row || !user2Row) {
            console.warn(
              "[Matchmaking] Could not find user data for pairing"
            );
            continue;
          }

          const toPublicUser = (u: any): PublicUser => ({
            id: u.id,
            username: u.username,
            rating: Math.round(u.rating),
            gamesPlayed: u.games_played ?? 0,
            wins: u.wins ?? 0,
            losses: u.losses ?? 0,
            draws: u.draws ?? 0,
          });

          const user1 = toPublicUser(user1Row);
          const user2 = toPublicUser(user2Row);

          // Fetch a real problem from database
          const problemResult = await pool.query(
            "SELECT id, slug, title, statement, difficulty, rating, time_limit_ms, memory_limit_kb, tags FROM problems ORDER BY RANDOM() LIMIT 1"
          );
          const problemRow = problemResult.rows[0];

          let sampleTests: Array<{ input: string; expectedOutput: string }> = [];
          if (problemRow) {
            const testCasesResult = await pool.query(
              "SELECT input, expected_output FROM test_cases WHERE problem_id = $1 AND is_sample = true ORDER BY ordinal ASC",
              [problemRow.id]
            );
            sampleTests = testCasesResult.rows.map((tc: any) => ({
              input: tc.input,
              expectedOutput: tc.expected_output,
            }));
          }

          const publicProblem: PublicProblem = problemRow
            ? {
                id: problemRow.id,
                slug: problemRow.slug,
                title: problemRow.title,
                statement: problemRow.statement,
                difficulty: problemRow.difficulty,
                timeLimitMs: problemRow.time_limit_ms,
                memoryLimitKb: problemRow.memory_limit_kb,
                tags: problemRow.tags || [],
                sampleTests,
              }
            : {
                id: "00000000-0000-0000-0000-000000000001",
                slug: "two-sum",
                title: "Two Sum",
                statement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
                difficulty: "easy",
                timeLimitMs: 2000,
                memoryLimitKb: 262144,
                tags: ["Array", "Hash Table"],
                sampleTests: [],
              };

          const matchDurationMs = 300_000;
          const now = new Date();
          const endsAtDate = new Date(Date.now() + matchDurationMs + 3_000);

          // INSERT real row into matches table in Postgres
          await pool.query(
            `INSERT INTO matches (id, problem_id, mode, status, player_one_id, player_two_id, started_at, ended_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              matchId,
              publicProblem.id,
              mode,
              "waiting",
              player1.userId,
              player2.userId,
              now,
              endsAtDate,
            ]
          );

          // Create in-memory & Redis room
          await matchHandler.createRoom(
            roomId,
            matchId,
            [player1.userId, player2.userId],
            publicProblem.id,
            matchDurationMs
          );

          // Transition to countdown phase
          await matchHandler.transitionPhase(roomId, "countdown");

          // After 3 second countdown, transition to active
          const COUNTDOWN_MS = 3_000;
          setTimeout(async () => {
            try {
              const activeRoom = matchHandler.getRoom(roomId);
              if (activeRoom && activeRoom.phase === "countdown") {
                const startedAt = Date.now();
                const endsAt = startedAt + matchDurationMs;
                activeRoom.startedAt = startedAt;
                activeRoom.endsAt = endsAt;
                await matchHandler.transitionPhase(roomId, "active");

                // Update database match status to active
                await pool.query(
                  "UPDATE matches SET status = 'active', started_at = NOW(), ended_at = $1 WHERE id = $2",
                  [new Date(endsAt), matchId]
                );

                console.log(
                  `[Matchmaking] 🚀 Match ${matchId} started in room ${roomId}`
                );
              }
            } catch (transitionErr) {
              console.error("[Matchmaking] Error in countdown transition:", transitionErr);
            }
          }, COUNTDOWN_MS);

          // Emit match_found to both players
          const matchFoundPayload1: MatchFoundPayload = {
            roomId,
            matchId,
            problem: publicProblem,
            opponent: user2,
            countdownMs: 3_000,
          };

          const matchFoundPayload2: MatchFoundPayload = {
            roomId,
            matchId,
            problem: publicProblem,
            opponent: user1,
            countdownMs: 3_000,
          };

          // Send to player 1's socket
          const player1Socket = io.sockets.sockets.get(player1.socketId);
          if (player1Socket) {
            player1Socket.join(`room:${roomId}`);
            player1Socket.emit(SOCKET_EVENTS.MATCH_FOUND, matchFoundPayload1);
          }

          // Send to player 2's socket
          const player2Socket = io.sockets.sockets.get(player2.socketId);
          if (player2Socket) {
            player2Socket.join(`room:${roomId}`);
            player2Socket.emit(SOCKET_EVENTS.MATCH_FOUND, matchFoundPayload2);
          }

          console.log(
            `[Matchmaking] 🎮 Matched ${player1.userId} (${player1.rating}) ⚔️ ${player2.userId} (${player2.rating}) in room ${roomId} for match ${matchId}`
          );

          // Remove both from queue
          await redis.zrem(queueKey, player1.userId, player2.userId);
          await redis.del(`user:${player1.userId}:queue`);
          await redis.del(`user:${player2.userId}:queue`);

          matched.add(player1.userId);
          matched.add(player2.userId);
        } catch (err) {
          console.error(`[Matchmaking] Error creating match:`, err);
        }

        break; // Move to next player after successful pairing
      }
    }
  }
}
