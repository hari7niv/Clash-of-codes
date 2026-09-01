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

import type Redis from "ioredis";
import type { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db/client.js";
import type { MatchHandler } from "./match-handler.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, MatchFoundPayload } from "@clashofcode/shared";
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
  // Track matched pairs within this interval to avoid double-matching
  let lastRunTime = Date.now();

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

        // Create match
        const roomId = uuidv4();
        const matchId = uuidv4();

        try {
          // Fetch full user data for both players (for PublicUser in payload)
          const result = await pool.query(
            "SELECT id, username, rating FROM users WHERE id = ANY($1::uuid[])",
            [[player1.userId, player2.userId]]
          );

          const users = result.rows as Array<{
            id: string;
            username: string;
            rating: number;
          }>;
          const user1 = users.find((u) => u.id === player1.userId);
          const user2 = users.find((u) => u.id === player2.userId);

          if (!user1 || !user2) {
            console.warn(
              "[Matchmaking] Could not find user data for pairing"
            );
            continue;
          }

          // Create room
          const room = await matchHandler.createRoom(
            roomId,
            matchId,
            [player1.userId, player2.userId],
            "problem-placeholder", // TODO: Select random problem
            300_000 // 5 minute match
          );

          // Transition to countdown phase
          await matchHandler.transitionPhase(roomId, "countdown");

          // After 3 second countdown, transition to active
          const COUNTDOWN_MS = 3_000;
          setTimeout(async () => {
            const activeRoom = matchHandler.getRoom(roomId);
            if (activeRoom && activeRoom.phase === "countdown") {
              // Set match end time to 5 minutes from now
              const matchDurationMs = 300_000;
              activeRoom.startedAt = Date.now();
              activeRoom.endsAt = Date.now() + matchDurationMs;
              await matchHandler.transitionPhase(roomId, "active");
              console.log(
                `[Matchmaking] 🚀 Match ${matchId} started in room ${roomId}`
              );
            }
          }, COUNTDOWN_MS);

          // Emit match_found to both players
          const matchFoundPayload1: MatchFoundPayload = {
            roomId,
            matchId,
            problem: {
              id: "problem-placeholder",
              title: "Sample Problem",
              description: "This is a sample problem",
              difficulty: "easy" as const,
              testCases: [],
            },
            opponent: {
              id: user2.id,
              username: user2.username,
              rating: user2.rating,
            },
            countdownMs: 3_000, // 3 second countdown before match starts
          };

          const matchFoundPayload2: MatchFoundPayload = {
            roomId,
            matchId,
            problem: {
              id: "problem-placeholder",
              title: "Sample Problem",
              description: "This is a sample problem",
              difficulty: "easy" as const,
              testCases: [],
            },
            opponent: {
              id: user1.id,
              username: user1.username,
              rating: user1.rating,
            },
            countdownMs: 3_000, // 3 second countdown before match starts
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
            `[Matchmaking] 🎮 Matched ${player1.userId} (${player1.rating}) ⚔️ ${player2.userId} (${player2.rating}) in room ${roomId}`
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
