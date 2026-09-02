/**
 * THE WEBSOCKET EVENT CONTRACT — one source of truth.
 *
 * Both the match-server (emitter) and any client (React app, load test, etc.)
 * import these exact types so the two can never drift. Socket.io is generic over
 * ClientToServerEvents / ServerToClientEvents / SocketData below.
 */

import type { PublicProblem } from './problem';
import type { PublicUser } from './user';
import type { Verdict } from './submission';
import type { MatchMode, RoomPhase, RatingChange } from './match';

/* -------------------------------------------------------------------------- */
/* Client -> Server                                                            */
/* -------------------------------------------------------------------------- */

export interface JoinQueuePayload {
  /** Only 'ranked' | 'casual' make sense for the public queue. */
  mode: Extract<MatchMode, 'ranked' | 'casual'>;
}

export type LeaveQueuePayload = Record<string, never>;

export interface SubmitCodePayload {
  roomId: string;
  /** Language key (validated against LANGUAGES server-side). */
  language: string;
  sourceCode: string;
  action?: 'run' | 'submit';
}

export interface RequestReconnectPayload {
  roomId: string;
}

/* -------------------------------------------------------------------------- */
/* Server -> Client                                                            */
/* -------------------------------------------------------------------------- */

export interface QueueJoinedPayload {
  mode: MatchMode;
  enqueuedAt: number;
}

export type QueueLeftPayload = Record<string, never>;

export interface MatchFoundPayload {
  roomId: string;
  matchId: string;
  problem: PublicProblem;
  opponent: PublicUser;
  countdownMs: number;
}

export interface MatchStartPayload {
  roomId: string;
  startedAt: number;
  endsAt: number;
}

/** Emitted to the *other* player when someone's submission is judged. */
export interface OpponentProgressPayload {
  roomId: string;
  verdict: Verdict;
  passedTests: number;
  totalTests: number;
}

/** Emitted to the submitter with their own result. */
export interface SubmissionResultPayload {
  roomId: string;
  submissionId: string;
  verdict: Verdict;
  passedTests: number;
  totalTests: number;
  runtimeMs: number | null;
}

export interface MatchResultPayload {
  roomId: string;
  matchId: string;
  /** null = draw. */
  winnerId: string | null;
  /** Rating change for *this* client. */
  you: RatingChange;
}

/** Full room snapshot — the answer to request_reconnect. */
export interface RoomStatePayload {
  roomId: string;
  phase: RoomPhase;
  problem: PublicProblem | null;
  opponent: PublicUser | null;
  endsAt: number | null;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Socket.io generics                                                          */
/* -------------------------------------------------------------------------- */

export interface ClientToServerEvents {
  join_queue: (payload: JoinQueuePayload) => void;
  leave_queue: (payload: LeaveQueuePayload) => void;
  submit_code: (payload: SubmitCodePayload) => void;
  request_reconnect: (payload: RequestReconnectPayload) => void;
}

export interface ServerToClientEvents {
  queue_joined: (payload: QueueJoinedPayload) => void;
  queue_left: (payload: QueueLeftPayload) => void;
  match_found: (payload: MatchFoundPayload) => void;
  match_start: (payload: MatchStartPayload) => void;
  opponent_progress: (payload: OpponentProgressPayload) => void;
  submission_result: (payload: SubmissionResultPayload) => void;
  match_result: (payload: MatchResultPayload) => void;
  room_state: (payload: RoomStatePayload) => void;
  error_event: (payload: ErrorPayload) => void;
}

/** Attached to each socket after JWT handshake auth. */
export interface SocketData {
  userId: string;
  username: string;
  rating: number;
}

/** String constants so handlers never hard-code event names. */
export const SOCKET_EVENTS = {
  // client -> server
  JOIN_QUEUE: 'join_queue',
  LEAVE_QUEUE: 'leave_queue',
  SUBMIT_CODE: 'submit_code',
  REQUEST_RECONNECT: 'request_reconnect',
  // server -> client
  QUEUE_JOINED: 'queue_joined',
  QUEUE_LEFT: 'queue_left',
  MATCH_FOUND: 'match_found',
  MATCH_START: 'match_start',
  OPPONENT_PROGRESS: 'opponent_progress',
  SUBMISSION_RESULT: 'submission_result',
  MATCH_RESULT: 'match_result',
  ROOM_STATE: 'room_state',
  ERROR_EVENT: 'error_event',
} as const;
