/** Match + room lifecycle types. */

export type MatchMode = 'ranked' | 'casual' | 'room' | 'practice';

/** Persisted match status (DB). */
export type MatchStatus = 'waiting' | 'active' | 'judging' | 'completed' | 'abandoned';

/**
 * In-memory room phase owned by match-server (rooms/room.state.ts):
 *   WAITING -> COUNTDOWN -> ACTIVE -> JUDGING -> COMPLETED
 * Kept here so the client and server never drift on what a phase means
 * (used by the room_state reconnect event).
 */
export type RoomPhase = 'waiting' | 'countdown' | 'active' | 'judging' | 'completed';

export interface Match {
  id: string;
  problemId: string;
  mode: MatchMode;
  status: MatchStatus;
  playerOneId: string;
  /** null for practice (no opponent). */
  playerTwoId: string | null;
  /** null = draw or not finished. */
  winnerId: string | null;
  roomCode: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface RatingChange {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
}

export interface MatchResult {
  matchId: string;
  /** null = draw. */
  winnerId: string | null;
  /** Rating change for the recipient of this result. */
  rating: RatingChange;
}
