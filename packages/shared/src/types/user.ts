/**
 * User domain types.
 *
 * `User` is the full DB-backed entity. What actually leaves the server depends on
 * the audience: `PublicUser` is safe to show opponents/leaderboards, `AuthUser`
 * is the shape returned to the authenticated user about themselves.
 */

export interface User {
  id: string;
  username: string;
  email: string;
  /** Glicko-2 rating (r). */
  rating: number;
  /** Glicko-2 rating deviation (RD). */
  ratingDeviation: number;
  /** Glicko-2 volatility (sigma). */
  ratingVolatility: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: string;
  updatedAt: string;
}

/** Safe to expose to any client (opponents, leaderboard, profiles). */
export interface PublicUser {
  id: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Returned to the authenticated user about themselves (adds email). */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  rating: number;
}

/** JWT payload — MUST stay identical across api & match-server. */
export interface JwtPayload {
  /** subject = user id */
  sub: string;
  username: string;
}
