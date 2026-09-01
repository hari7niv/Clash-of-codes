import { Server } from "socket.io";
import { createServer } from "http";
import { listenToMatchQueue } from "./services/queue-listener.js";
import { handleMatchEvents } from "./services/match-handler.js";
import { DatabaseClient } from "./db/client.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Initialize database
const db = new DatabaseClient();

// Track active matches and their player sockets
const matchRooms = new Map<string, Set<string>>();

console.log("🚀 [Match Server] Starting...");
console.log(`   Redis URL: ${REDIS_URL}`);
console.log(`   Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`[Match Server] Client connected: ${socket.id}`);

  // Join match room
  socket.on("join_match", async (data: { matchId: string; userId: string }) => {
    const { matchId, userId } = data;
    const roomName = `match:${matchId}`;

    try {
      // Verify user is part of match
      const match = await db.getMatch(matchId);
      if (!match) {
        return socket.emit("error", { message: "Match not found" });
      }

      const isPlayer = match.playerOneId === userId || match.playerTwoId === userId;
      if (!isPlayer) {
        return socket.emit("error", { message: "Not authorized" });
      }

      // Join socket.io room
      socket.join(roomName);

      // Track socket in match room
      if (!matchRooms.has(matchId)) {
        matchRooms.set(matchId, new Set());
      }
      matchRooms.get(matchId)!.add(socket.id);

      // Send current match state
      socket.emit("match_state", match);

      // Notify other players
      socket.to(roomName).emit("player_joined", { userId });

      console.log(`[Match Server] Player ${userId} joined match ${matchId}`);
    } catch (err: any) {
      console.error(`[Match Server] Error joining match: ${err.message}`);
      socket.emit("error", { message: "Failed to join match" });
    }
  });

  // Leave match room
  socket.on("disconnect", () => {
    console.log(`[Match Server] Client disconnected: ${socket.id}`);

    // Remove socket from all match rooms
    matchRooms.forEach((sockets, matchId) => {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        io.to(`match:${matchId}`).emit("player_left", { socket_id: socket.id });
      }
    });
  });

  // Handle submission events
  socket.on("submit_code", (data: { matchId: string; userId: string; submissionId: string }) => {
    const { matchId } = data;
    const roomName = `match:${matchId}`;
    io.to(roomName).emit("submission_received", data);
  });

  // Handle chat/comments
  socket.on("send_message", (data: { matchId: string; userId: string; message: string }) => {
    const { matchId } = data;
    const roomName = `match:${matchId}`;
    io.to(roomName).emit("message", data);
  });
});

// Listen to BullMQ judge queue for submission updates
listenToMatchQueue(io, db, REDIS_URL);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Match Server] SIGTERM received, shutting down gracefully...");
  io.close();
  httpServer.close(() => {
    console.log("[Match Server] Closed");
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
