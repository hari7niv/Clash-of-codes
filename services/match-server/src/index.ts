import { Server } from "socket.io";
import { createServer } from "http";
import Redis from "ioredis";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { listenToMatchQueue } from "./services/queue-listener.js";
import { MatchHandler } from "./services/match-handler.js";
import { startMatchmakingLoop } from "./services/matchmaking-loop.js";
import { checkDbConnection, closeDb, pool } from "./db/client.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, JoinQueuePayload, LeaveQueuePayload, SubmitCodePayload, RequestReconnectPayload } from "@clashofcode/shared";
import { SOCKET_EVENTS } from "@clashofcode/shared";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

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
const redis = new Redis(REDIS_URL);
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
    console.error("❌ Failed to initialize database connection");
    process.exit(1);
  }
})();

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`[Match Server] Client connected: ${socket.id}`);

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
  socket.on(SOCKET_EVENTS.LEAVE_QUEUE, async (payload: LeaveQueuePayload) => {
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
      const { roomId, language, sourceCode } = payload;
      const userId = socket.data.userId;

      if (!userId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHENTICATED",
          message: "User not authenticated",
        });
      }

      const room = matchHandler.getRoom(roomId);
      if (!room) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "ROOM_NOT_FOUND",
          message: "Room not found",
        });
      }

      if (!room.playerIds.includes(userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_IN_ROOM",
          message: "You are not in this room",
        });
      }

      // Create submission in database
      const submissionId = uuidv4();
      const now = Date.now();

      try {
        // TODO: Create submission record and enqueue judge job
        // This requires integration with judge-worker queue (P2)
        // For now, just acknowledge the submission
        matchHandler.registerSubmission(submissionId, userId, roomId);

        console.log(
          `[Match Server] Player ${userId} submitted code in room ${roomId} (${language})`
        );

        socket.emit(SOCKET_EVENTS.SUBMISSION_RESULT, {
          roomId,
          submissionId,
          verdict: "pending",
          passedTests: 0,
          totalTests: 0,
          runtimeMs: null,
        });

        // TODO: Broadcast opponent_progress to other player when judge completes
      } catch (err) {
        console.error("[Match Server] Error creating submission:", err);
        socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "SUBMISSION_FAILED",
          message: "Failed to create submission",
        });
      }
    } catch (err: any) {
      console.error(`[Match Server] Error in submit_code:`, err.message);
      socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
        code: "SUBMISSION_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * CANONICAL EVENT: request_reconnect
   * Client requests room state after a disconnect/reconnect
   */
  socket.on(SOCKET_EVENTS.REQUEST_RECONNECT, async (payload: RequestReconnectPayload) => {
    try {
      const { roomId } = payload;
      const userId = socket.data.userId;

      if (!userId) {
        return socket.emit(SOCKET_EVENTS.ERROR_EVENT, {
          code: "NOT_AUTHENTICATED",
          message: "User not authenticated",
        });
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

      // Re-register socket and rejoin room
      matchHandler.registerSocket(userId, socket.id);
      socket.join(`room:${roomId}`);

      // Remove from disconnected players set
      room.disconnectedPlayers.delete(userId);

      // Send full room state
      socket.emit(SOCKET_EVENTS.ROOM_STATE, {
        roomId: room.roomId,
        phase: room.phase,
        problem: null, // TODO: Fetch from database
        opponent: null, // TODO: Fetch from database
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
   * Implements 60-second grace period for reconnection
   */
  socket.on("disconnect", () => {
    console.log(`[Match Server] Client disconnected: ${socket.id}`);

    const userId = socket.data.userId;
    if (!userId) return;

    matchHandler.unregisterSocket(userId);

    // Find all rooms this user is in
    // Check all rooms for this player and mark them as disconnected
    for (const room of Array.from(matchHandler.getRooms().values())) {
      if (room.playerIds.includes(userId)) {
        if (room.phase === "active" || room.phase === "judging") {
          // Start grace period
          room.disconnectedPlayers.add(userId);
          const gracePeriodMs = 60_000; // 60 seconds
          const graceTimer = setTimeout(() => {
            console.log(
              `[Match Server] Grace period expired for ${userId} in room ${room.roomId}`
            );
            room.disconnectedPlayers.delete(userId);
            // TODO: Mark as forfeited, declare opponent winner
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
(async () => {
  try {
    const cleanupMatchmaking = await startMatchmakingLoop(redis, io, matchHandler);
    // Store for graceful shutdown
    (global as any).cleanupMatchmaking = cleanupMatchmaking;
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
    // Only broadcast timer if match is active and not completed
    if (room.phase !== "active" || room.endsAt === null) {
      continue;
    }

    const timeRemaining = Math.max(0, room.endsAt - now);

    // Broadcast to all players in room
    io.to(`room:${room.roomId}`).emit("timer_sync" as any, {
      roomId: room.roomId,
      timeRemainingMs: timeRemaining,
      serverTime: now,
    });

    // If time is up, transition room to judging phase
    if (timeRemaining <= 0 && room.phase === "active") {
      matchHandler.transitionPhase(room.roomId, "judging").catch((err) => {
        console.error(`[Match Server] Error transitioning room ${room.roomId}:`, err);
      });
    }
  }
}, 100); // Broadcast every 100ms for smooth client timers

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Match Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Match Server] SIGINT received, shutting down gracefully...");

  // Stop matchmaking loop
  if ((global as any).cleanupMatchmaking) {
    (global as any).cleanupMatchmaking();
  }

  // Stop timer broadcasts
  clearInterval(timerInterval);

  await closeDb();
  redis.disconnect();
  io.close();
  httpServer.close(() => {
    console.log("[Match Server] ✅ Shutdown complete");
    process.exit(0);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Match Server] SIGTERM received, shutting down gracefully...");

  // Stop matchmaking loop
  if ((global as any).cleanupMatchmaking) {
    (global as any).cleanupMatchmaking();
  }

  // Stop timer broadcasts
  clearInterval(timerInterval);

  io.close();
  httpServer.close(() => {
    console.log("[Match Server] ✅ Closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[Match Server] SIGINT received, shutting down gracefully...");
  io.close();
  httpServer.close(() => {
    console.log("[Match Server] Closed");
    process.exit(0);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ [Match Server] Listening on port ${PORT}`);
});
