/**
 * Handles match state transitions and room lifecycle.
 * Maintains a mapping of:
 * - roomId -> match state (phase, timer, players)
 * - userId -> socket.id for reconnection support
 * - submissionId -> (userId, roomId) for verdict routing
 */

import type { Redis } from "ioredis";

export interface RoomState {
  roomId: string;
  matchId: string;
  phase: "waiting" | "countdown" | "active" | "disconnect_grace" | "judging" | "completed";
  playerIds: string[];
  problemId: string;
  startedAt: number | null;
  endsAt: number | null;
  submissions: Map<string, { userId: string; verdict?: string }>;
  disconnectedPlayers: Set<string>;
  graceTimers: Map<string, NodeJS.Timeout>;
}

export class MatchHandler {
  private redis: Redis;
  private rooms: Map<string, RoomState> = new Map();
  private submissionToRoom: Map<string, string> = new Map(); // submission ID -> room ID
  private userToSocket: Map<string, string> = new Map(); // user ID -> socket ID

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get all rooms (for iteration by timers, etc.)
   */
  getRooms(): Map<string, RoomState> {
    return this.rooms;
  }

  /**
   * Create a new match room when two players are paired
   */
  async createRoom(
    roomId: string,
    matchId: string,
    playerIds: string[],
    problemId: string,
    durationMs: number = 300_000
  ): Promise<RoomState> {
    const now = Date.now();
    const room: RoomState = {
      roomId,
      matchId,
      phase: "waiting",
      playerIds,
      problemId,
      startedAt: null,
      endsAt: null,
      submissions: new Map(),
      disconnectedPlayers: new Set(),
      graceTimers: new Map(),
    };

    this.rooms.set(roomId, room);

    const ttlSeconds = Math.ceil(durationMs / 1000) + 600; // duration + 10 min buffer

    // Persist to Redis for multi-instance support
    await this.redis.setex(
      `room:${roomId}`,
      ttlSeconds,
      JSON.stringify({
        roomId,
        matchId,
        phase: room.phase,
        playerIds,
        problemId,
        createdAt: now,
      })
    );

    // FIX P0 BUG 1: Create bidirectional match<->room mapping
    await this.redis.setex(`match-room:${matchId}`, ttlSeconds, roomId);
    await this.redis.setex(`room-match:${roomId}`, ttlSeconds, matchId);

    console.log(
      `[Match Handler] 📍 Created room ${roomId} for match ${matchId} with players ${playerIds.join(", ")}`
    );

    return room;
  }

  /**
   * Transition room to a new phase
   */
  async transitionPhase(
    roomId: string,
    newPhase: RoomState["phase"]
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const oldPhase = room.phase;
    room.phase = newPhase;

    console.log(
      `[Match Handler] 🔄 Room ${roomId}: ${oldPhase} → ${newPhase}`
    );

    // Update Redis cache
    await this.redis.setex(
      `room:${roomId}`,
      600,
      JSON.stringify({
        roomId: room.roomId,
        matchId: room.matchId,
        phase: newPhase,
        playerIds: room.playerIds,
        problemId: room.problemId,
      })
    );
  }

  /**
   * Get room ID for a submission (used by verdict bridge)
   */
  getRoomForSubmission(submissionId: string): string | undefined {
    return this.submissionToRoom.get(submissionId);
  }

  /**
   * Register a submission for verdict routing
   */
  registerSubmission(
    submissionId: string,
    userId: string,
    roomId: string
  ): void {
    this.submissionToRoom.set(submissionId, roomId);
    const room = this.rooms.get(roomId);
    if (room) {
      room.submissions.set(submissionId, { userId });
    }
  }

  /**
   * Update submission with verdict
   */
  updateSubmissionVerdict(
    submissionId: string,
    verdict: string,
    passedTests?: number,
    totalTests?: number
  ): void {
    const roomId = this.submissionToRoom.get(submissionId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const submission = room.submissions.get(submissionId);
    if (submission) {
      submission.verdict = verdict;
      // Store counts if needed
      if (passedTests !== undefined) {
        (submission as any).passedTests = passedTests;
      }
      if (totalTests !== undefined) {
        (submission as any).totalTests = totalTests;
      }
    }
  }

  /**
   * Register socket for a user (for reconnection support)
   */
  registerSocket(userId: string, socketId: string): void {
    this.userToSocket.set(userId, socketId);
  }

  /**
   * FIX P0 BUG 4: Safe unregister - only delete if socketId matches
   * Prevents old socket disconnect from deleting new socket mapping
   */
  unregisterSocket(userId: string, socketId: string): void {
    const currentSocketId = this.userToSocket.get(userId);
    if (currentSocketId === socketId) {
      this.userToSocket.delete(userId);
    } else {
      console.log(
        `[Match Handler] Skipping unregister for ${userId}: socket ${socketId} is not current (current: ${currentSocketId})`
      );
    }
  }

  /**
   * Get socket ID for a user
   */
  getSocketForUser(userId: string): string | undefined {
    return this.userToSocket.get(userId);
  }

  /**
   * FIX P0 BUG 1: Lookup roomId from matchId via Redis
   */
  async getRoomIdForMatch(matchId: string): Promise<string | null> {
    try {
      const roomId = await this.redis.get(`match-room:${matchId}`);
      return roomId;
    } catch (err) {
      console.error(`[Match Handler] Error looking up roomId for match ${matchId}:`, err);
      return null;
    }
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Clean up a completed/abandoned room
   */
  cleanupRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Clear grace period timers
    for (const timer of room.graceTimers.values()) {
      clearTimeout(timer);
    }

    // Remove submission mappings
    for (const [submissionId] of room.submissions) {
      this.submissionToRoom.delete(submissionId);
    }

    // Remove room from memory
    this.rooms.delete(roomId);

    // Remove from Redis (including bidirectional mappings)
    this.redis.del(`room:${roomId}`).catch((err: unknown) => {
      console.error(`[Match Handler] Error deleting Redis room ${roomId}:`, err);
    });
    
    // FIX P0 BUG 1: Clean up match<->room mappings
    this.redis.del(`match-room:${room.matchId}`).catch((err: unknown) => {
      console.error(`[Match Handler] Error deleting match-room mapping:`, err);
    });
    this.redis.del(`room-match:${roomId}`).catch((err: unknown) => {
      console.error(`[Match Handler] Error deleting room-match mapping:`, err);
    });

    console.log(`[Match Handler] 🗑️  Cleaned up room ${roomId} and mappings`);
  }
}
