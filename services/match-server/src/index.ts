import { Server } from "socket.io";
import { createServer } from "http";
import { Redis } from "ioredis";
import { Queue } from "bullmq";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { listenToMatchQueue } from "./services/queue-listener.js";
import { MatchHandler } from "./services/match-handler.js";
import { startMatchmakingLoop } from "./services/matchmaking-loop.js";
import { checkDbConnection, closeDb, pool } from "./db/client.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  JoinQueuePayload,
  LeaveQueuePayload,
  SubmitCodePayload,
  RequestReconnectPayload,
  PublicProblem,
  PublicUser,
} from "@clashofcode/shared";
import { SOCKET_EVENTS, computeMatchRatings } from "@clashofcode/shared";
import { createSubmission } from "./services/submission-service.js";
import { completeMatch } from "./services/match-completion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const PORT = parseInt(process.env.PORT || "4100", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret-dev-key";
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME || "judge";

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(
  httpServer,
  {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
  }
);

// Redis connection for matchmaking queue and pub/sub
// BullMQ requires maxRetriesPerRequest: null for blocking operations
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});
const matchHandler = new MatchHandler(redis);

console.log("🚀 [Match Server] Starting...");
console.log(`   Redis URL: ${REDIS_URL}`);
console.log(`   Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
console.log(`   Port: ${PORT}`);

// Initialize database connection
(async () => {
  try {
    await checkDbConnection();
  } catch (err) {
    console.error("❌ Failed to initialize database connection:", err);
    process.exit(1);
  }
})();

// JWT Authentication Middleware: Verify token during handshake
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.query?.token as string | undefined);

    if (!token) {
      console.warn(`[Match Server] Connection rejected (no token): ${socket.id}`);
      return next(new Error("Authentication error: Token required"));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.id || decoded.sub;

    if (!userId) {
      console.warn(`[Match Server] Connection rejected (invalid claims): ${socket.id}`);
      return next(new Error("Authentication error: Invalid token payload"));
    }

    socket.data.userId = userId;
    socket.data.username = decoded.username || "Player";
    socket.data.rating = decoded.rating || 1500;

    console.log(`[Match Server] 🔑 Authenticated user ${userId} (${socket.data.username}) on socket ${socket.id}`);
    next();
  } catch (err: any) {
    console.warn(`[Match Server] JWT verification failed for ${socket.id}: ${err.message}`);
    return next(new Error(`Authentication error: ${err.message}`));
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`[Match Server] Client connected: ${socket.id} (User: ${socket.data.userId})`);

  /**
   * CANONICAL EVENT: join_queue
   * Client joins the matchmaking queue for a specific mode (ranked/casual)
   */
  socket.on(SOCKET_EVENTS.JOIN_QUEUE, async (payload: JoinQueuePayload) => {
    try {
      const { mode } = payload;
      const userId = socket.data.userId;

      if (!userId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHENTICATED",
          message: "User not authenticated",
        });
      }

      // Fetch player rating from database
      const userResult = await pool.query(
        "SELECT id, rating FROM users WHERE id = $1",
        [userId]
      );

      if (userResult.rows.length === 0) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "USER_NOT_FOUND",
          message: "User not found",
        });
      }

      const rating = userResult.rows[0].rating;
      const enqueuedAt = Date.now();

      console.log(
        `[Match Server] Player ${userId} (rating: ${rating}) joined ${mode} queue (socket: ${socket.id})`
      );

      // Register socket for this user
      matchHandler.registerSocket(userId, socket.id);

      // Add to Redis queue:
      // 1. Sorted set with rating as score (for pairing algorithm)
      // 2. Hash with socket ID and enqueue time (for matchmaking loop)
      const queueKey = `queue:${mode}`;
      await redis.zadd(queueKey, rating, userId);
      await redis.hset(
        `user:${userId}:queue`,
        "socketId",
        socket.id,
        "enqueuedAt",
        enqueuedAt.toString()
      );

      // Acknowledge queue join
      socket.emit(SOCKET_EVENTS.QUEUE_JOINED, {
        mode,
        enqueuedAt,
      });

      console.log(`[Match Server] ✅ Queue ${mode} size: ${await redis.zcard(queueKey)}`);
    } catch (err: any) {
      console.error(`[Match Server] Error in join_queue:`, err.message);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: "QUEUE_JOIN_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * CANONICAL EVENT: leave_queue
   * Client leaves the matchmaking queue
   */
  socket.on(SOCKET_EVENTS.LEAVE_QUEUE, async (_payload: LeaveQueuePayload) => {
    try {
      const userId = socket.data.userId;

      if (!userId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHENTICATED",
          message: "User not authenticated",
        });
      }

      console.log(`[Match Server] Player ${userId} left queue (socket: ${socket.id})`);

      // Find which queue they were in and remove them
      for (const mode of ["ranked", "casual"]) {
        const queueKey = `queue:${mode}`;
        const removed = await redis.zrem(queueKey, userId);
        if (removed > 0) {
          console.log(`[Match Server] ✅ Removed ${userId} from ${mode} queue`);
          break;
        }
      }

      // Clean up queue metadata
      await redis.del(`user:${userId}:queue`);

      socket.emit(SOCKET_EVENTS.QUEUE_LEFT, {});
    } catch (err: any) {
      console.error(`[Match Server] Error in leave_queue:`, err.message);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: "QUEUE_LEAVE_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * CANONICAL EVENT: submit_code
   * Client submits code during an active match
   */
  socket.on(SOCKET_EVENTS.SUBMIT_CODE, async (payload: SubmitCodePayload) => {
    try {
      // FIX P0 BUG 2: Validate both roomId AND matchId
      const { roomId, matchId, language, sourceCode, action } = payload;
      const userId = socket.data.userId;

      if (!userId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHENTICATED",
          message: "User not authenticated",
        });
      }

      // Validate required fields
      if (!roomId && !matchId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "INVALID_PAYLOAD",
          message: "Either roomId or matchId is required",
        });
      }

      let activeRoomId = roomId;
      
      // If no roomId provided, try to resolve it from matchId
      if (!activeRoomId && matchId) {
        const resolvedRoomId = await matchHandler.getRoomIdForMatch(matchId);
        if (resolvedRoomId) {
          activeRoomId = resolvedRoomId;
        } else {
          return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
            code: "ROOM_NOT_FOUND",
            message: "Could not find active room for this match",
          });
        }
      }

      const room = matchHandler.getRoom(activeRoomId);
      if (!room) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "ROOM_NOT_FOUND",
          message: "Room not found",
        });
      }

      // FIX P0 BUG 2: Verify matchId matches room's matchId
      if (matchId && room.matchId !== matchId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "MATCH_MISMATCH",
          message: "Room matchId does not match provided matchId",
        });
      }

      if (!room.playerIds.includes(userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_IN_ROOM",
          message: "You are not in this room",
        });
      }

      // Validate match is in correct phase
      if (room.phase !== "active" && room.phase !== "judging") {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "INVALID_PHASE",
          message: `Cannot submit during ${room.phase} phase`,
        });
      }

      console.log(
        `[Match Server] 📥 Submission from ${userId} in room ${activeRoomId} (match ${matchId}): ${language}, action: ${action}`
      );

      // FIX P0 BUG 7: Use shared submission service (single source of truth)
      const result = await createSubmission({
        matchId,
        userId,
        problemId: room.problemId,
        language,
        sourceCode,
        action: action || "submit",
      });

      if (!result.success) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: result.errorCode || "SUBMISSION_FAILED",
          message: result.error || "Failed to create submission",
        });
      }

      const submissionId = result.submissionId!;

      // Register submission in matchHandler for verdict bridge routing
      matchHandler.registerSubmission(submissionId, userId, activeRoomId);

      console.log(
        `[Match Server] ✅ Submission ${submissionId} created & enqueued for player ${userId}`
      );

      // Acknowledge submission to submitter with pending status
      socket.emit(SOCKET_EVENTS.SUBMISSION_RESULT, {
        roomId: activeRoomId,
        submissionId,
        verdict: "pending",
        passedTests: 0,
        totalTests: 0,
        runtimeMs: null,
      });
    } catch (err: any) {
      console.error(`[Match Server] Error in submit_code:`, err);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: "SUBMISSION_FAILED",
        message: err.message || "Failed to process code submission",
      });
    }
  });

  /**
   * FIX P0 BUG 1: NEW EVENT - resolve_match_room
   * Client provides matchId to get roomId (breaks circular dependency)
   */
  socket.on("resolve_match_room", async (payload: { matchId: string }) => {
    try {
      const { matchId } = payload;
      const userId = socket.data.userId;

      if (!userId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHENTICATED",
          message: "User not authenticated",
        });
      }

      if (!matchId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "INVALID_PAYLOAD",
          message: "matchId is required",
        });
      }

      console.log(
        `[Match Server] Player ${userId} resolving roomId for match ${matchId}`
      );

      // Verify user is participant in this match
      const matchRes = await pool.query(
        "SELECT id, player_one_id, player_two_id, status FROM matches WHERE id = $1",
        [matchId]
      );

      if (matchRes.rows.length === 0) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "MATCH_NOT_FOUND",
          message: "Match not found",
        });
      }

      const match = matchRes.rows[0];
      const isParticipant = match.player_one_id === userId || match.player_two_id === userId;

      if (!isParticipant) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHORIZED",
          message: "You are not a participant in this match",
        });
      }

      // Lookup roomId from Redis
      const roomId = await matchHandler.getRoomIdForMatch(matchId);
      
      if (!roomId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "ROOM_NOT_FOUND",
          message: "Room mapping not found for this match",
        });
      }

      console.log(
        `[Match Server] ✅ Resolved match ${matchId} -> room ${roomId}`
      );

      // Emit room mapping to client
      socket.emit("match_room_resolved", {
        matchId,
        roomId,
      });
    } catch (err: any) {
      console.error(`[Match Server] Error in resolve_match_room:`, err.message);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: "RESOLVE_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * CANONICAL EVENT: request_reconnect
   * Client requests room state after a disconnect/reconnect
   * NOW requires actual roomId (not matchId)
   */
  socket.on(SOCKET_EVENTS.REQUEST_RECONNECT, async (payload: RequestReconnectPayload) => {
    try {
      let { roomId, matchId } = payload;
      const userId = socket.data.userId;

      if (!userId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHENTICATED",
          message: "User not authenticated",
        });
      }

      // FIX: If roomId not provided or invalid, resolve from matchId
      if (!roomId || roomId === matchId) {
        if (!matchId) {
          return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
            code: "INVALID_PAYLOAD",
            message: "Must provide either roomId or matchId",
          });
        }
        
        console.log(`[Match Server] Resolving roomId from matchId ${matchId} for user ${userId}`);
        const resolvedRoomId = await matchHandler.getRoomIdForMatch(matchId);
        
        if (!resolvedRoomId) {
          return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
            code: "ROOM_NOT_FOUND",
            message: "Room not found for this match. It may have ended.",
          });
        }
        
        roomId = resolvedRoomId;
        console.log(`[Match Server] Resolved matchId ${matchId} → roomId ${roomId}`);
      }

      console.log(
        `[Match Server] Player ${userId} requesting reconnect to room ${roomId}`
      );

      const room = matchHandler.getRoom(roomId);
      if (!room) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "ROOM_NOT_FOUND",
          message: "Room not found",
        });
      }

      // Verify user is part of this room
      if (!room.playerIds.includes(userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHORIZED",
          message: "You are not part of this room",
        });
      }

      // Clear any pending grace timer for this user
      const existingTimer = room.graceTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        room.graceTimers.delete(userId);
        console.log(`[Match Server] ⏱️ Cancelled grace timer for reconnected user ${userId}`);
      }

      // Re-register socket and rejoin room
      matchHandler.registerSocket(userId, socket.id);
      socket.join(`room:${roomId}`);

      // Remove from disconnected players set
      room.disconnectedPlayers.delete(userId);

      // Fetch problem and opponent details for full room snapshot
      let publicProblem: PublicProblem | null = null;
      let opponent: PublicUser | null = null;

      const problemRes = await pool.query(
        "SELECT id, slug, title, statement, difficulty, rating, time_limit_ms, memory_limit_kb, tags FROM problems WHERE id = $1",
        [room.problemId]
      );
      if (problemRes.rows.length > 0) {
        const p = problemRes.rows[0];
        const tcRes = await pool.query(
          "SELECT input, expected_output FROM test_cases WHERE problem_id = $1 AND is_sample = true ORDER BY ordinal ASC",
          [p.id]
        );
        publicProblem = {
          id: p.id,
          slug: p.slug,
          title: p.title,
          statement: p.statement,
          difficulty: p.difficulty,
          timeLimitMs: p.time_limit_ms,
          memoryLimitKb: p.memory_limit_kb,
          tags: p.tags || [],
          sampleTests: tcRes.rows.map((tc: any) => ({
            input: tc.input,
            expectedOutput: tc.expected_output,
          })),
        };
      }

      const opponentId = room.playerIds.find((id) => id !== userId);
      if (opponentId) {
        const oppRes = await pool.query(
          "SELECT id, username, rating, games_played, wins, losses, draws FROM users WHERE id = $1",
          [opponentId]
        );
        if (oppRes.rows.length > 0) {
          const u = oppRes.rows[0];
          opponent = {
            id: u.id,
            username: u.username,
            rating: Math.round(u.rating),
            gamesPlayed: u.games_played ?? 0,
            wins: u.wins ?? 0,
            losses: u.losses ?? 0,
            draws: u.draws ?? 0,
          };
        }
      }

      // Send full room state
      socket.emit(SOCKET_EVENTS.ROOM_STATE, {
        roomId: room.roomId,
        phase: room.phase,
        problem: publicProblem,
        opponent,
        endsAt: room.endsAt,
      });

      console.log(
        `[Match Server] Player ${userId} reconnected to room ${roomId}`
      );
    } catch (err: any) {
      console.error(`[Match Server] Error in request_reconnect:`, err.message);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: "RECONNECT_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * Socket disconnect handler
   * Implements 60-second grace period with automatic forfeit and rating resolution
   */
  socket.on("disconnect", () => {
    console.log(`[Match Server] Client disconnected: ${socket.id}`);

    const userId = socket.data.userId;
    if (!userId) return;

    // FIX P0 BUG 4: Pass socketId to prevent race condition
    matchHandler.unregisterSocket(userId, socket.id);

    // Check all rooms for this player and mark them as disconnected
    for (const room of Array.from(matchHandler.getRooms().values())) {
      if (room.playerIds.includes(userId)) {
        if (room.phase === "active" || room.phase === "judging") {
          room.disconnectedPlayers.add(userId);
          const gracePeriodMs = 60_000; // 60 seconds

          const graceTimer = setTimeout(async () => {
            console.log(
              `[Match Server] ⌛ Grace period expired for ${userId} in room ${room.roomId}`
            );
            room.disconnectedPlayers.delete(userId);
            room.graceTimers.delete(userId);

            // If match is still active or judging, complete it with forfeit
            if (room.phase === "active" || room.phase === "judging") {
              const winnerId = room.playerIds.find((id) => id !== userId);
              await matchHandler.transitionPhase(room.roomId, "completed");

              if (winnerId) {
                // FIX P0 BUG 5 + 6: Use completeMatch service with forfeit reason
                try {
                  const result = await completeMatch({
                    matchId: room.matchId,
                    reason: "forfeit",
                    forcedWinnerId: winnerId, // Opponent wins by forfeit
                  });

                  if (result.success) {
                    console.log(
                      `[Match Server] 🏆 Match ${room.matchId} completed by forfeit. Winner: ${winnerId}`
                    );

                    // Emit match_result to winner socket
                    const winnerSocketId = matchHandler.getSocketForUser(winnerId);
                    if (winnerSocketId) {
                      const winnerRating = result.ratingChanges?.playerOne?.before === result.ratingChanges?.playerOne?.after 
                        ? result.ratingChanges?.playerTwo 
                        : result.ratingChanges?.playerOne;
                      
                      io.to(winnerSocketId).emit(SOCKET_EVENTS.MATCH_RESULT, {
                        roomId: room.roomId,
                        matchId: room.matchId,
                        winnerId,
                        you: winnerRating
                          ? {
                              ratingBefore: winnerRating.before,
                              ratingAfter: winnerRating.after,
                              delta: winnerRating.delta,
                            }
                          : { ratingBefore: 0, ratingAfter: 0, delta: 0 },
                        reason: "opponent_disconnect",
                      });
                    }
                  } else {
                    console.error("[Match Server] Forfeit completion failed:", result.error);
                  }
                } catch (forfeitErr) {
                  console.error("[Match Server] Error in forfeit resolution:", forfeitErr);
                }
              }
            }
          }, gracePeriodMs);

          room.graceTimers.set(userId, graceTimer);
          console.log(
            `[Match Server] ⏳ Started 60s grace period for ${userId} in room ${room.roomId}`
          );
        }
      }
    }
  });
});

// Listen to BullMQ judge queue for completion events
(async () => {
  try {
    await listenToMatchQueue(io, redis, matchHandler);
  } catch (err) {
    console.error("❌ Failed to start queue listener:", err);
    process.exit(1);
  }
})();

// Start matchmaking loop
let cleanupMatchmaking: (() => void) | null = null;
(async () => {
  try {
    cleanupMatchmaking = await startMatchmakingLoop(redis, io, matchHandler);
    console.log("🎯 [Match Server] Matchmaking loop started");
  } catch (err) {
    console.error("❌ Failed to start matchmaking loop:", err);
    process.exit(1);
  }
})();

// Server-authoritative timer: Broadcast timer_sync every 100ms to all active rooms
const timerInterval = setInterval(() => {
  const now = Date.now();

  for (const room of Array.from(matchHandler.getRooms().values())) {
    if (room.phase !== "active" || room.endsAt === null) {
      continue;
    }

    const timeRemaining = Math.max(0, room.endsAt - now);

    io.to(`room:${room.roomId}`).emit("timer_sync" as any, {
      roomId: room.roomId,
      timeRemainingMs: timeRemaining,
      serverTime: now,
    });

    if (timeRemaining <= 0 && room.phase === "active") {
      matchHandler.transitionPhase(room.roomId, "judging").then(async () => {
        // FIX P0 BUG 5: Use completeMatch with time_expired reason
        console.log(`[Match Server] Time expired for room ${room.roomId}, completing match...`);
        
        const result = await completeMatch({
          matchId: room.matchId,
          reason: "time_expired",
        });
        
        if (result.success) {
          // Transition to completed phase
          await matchHandler.transitionPhase(room.roomId, "completed");
          
          // Emit match_result to both players with rating updates
          for (const playerId of room.playerIds) {
            const socketId = matchHandler.getSocketForUser(playerId);
            if (socketId) {
              const isPlayerOne = playerId === room.playerIds[0];
              const ratingChange = isPlayerOne ? result.ratingChanges?.playerOne : result.ratingChanges?.playerTwo;
              
              io.to(socketId).emit(SOCKET_EVENTS.MATCH_RESULT, {
                roomId: room.roomId,
                matchId: room.matchId,
                winnerId: result.winnerId || null,
                you: ratingChange ? {
                  ratingBefore: ratingChange.before,
                  ratingAfter: ratingChange.after,
                  delta: ratingChange.delta,
                } : { ratingBefore: 0, ratingAfter: 0, delta: 0 },
                reason: "time_expired",
              });
            }
          }
        } else {
          console.error(`[Match Server] Error completing room ${room.roomId}:`, result.error);
        }
      }).catch((err) => {
        console.error(`[Match Server] Error completing room ${room.roomId}:`, err);
      });
    }
  }
}, 100);

// Start server (single listen call)
httpServer.listen(PORT, () => {
  console.log(`✅ [Match Server] Listening on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\n[Match Server] Shutting down gracefully...");

  if (cleanupMatchmaking) {
    cleanupMatchmaking();
  }

  clearInterval(timerInterval);

  try {
    await closeDb();
    redis.disconnect();
    io.close();
    httpServer.close(() => {
      console.log("[Match Server] ✅ Shutdown complete");
      process.exit(0);
    });
  } catch (err) {
    console.error("[Match Server] Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

