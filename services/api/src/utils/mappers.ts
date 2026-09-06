import { tierForRating } from "@clashofcode/shared";
import type { users } from "../db/schema/users.js";

type UserRow = typeof users.$inferSelect;

// Local DTO types (not yet exported from shared package)
type RankName = string;
type UiVerdict = "Accepted" | "Wrong Answer" | "Time Limit Exceeded" | "Memory Limit Exceeded" | "Runtime Error" | "Compilation Error" | "Internal Error";

interface PublicUserDto {
  id: string;
  name: string;
  handle: string;
  initials: string;
  rating: number;
  rank: RankName;
}

interface PlayerProfileDto extends PublicUserDto {
  level: number;
  xp: number;
  xpGoal: number;
  winRate: number;
  wins: number;
  losses: number;
  streak: number;
  peak: number;
  battles: number;
  bio: string | null;
  location: string | null;
  visibility: "public" | "friends" | "private";
}

export const initialsOf = (value: string) => value.substring(0, 2).toUpperCase();

export const rankOf = (rating: number): RankName => tierForRating(Math.round(rating)).name as RankName;

export const toPublicUser = (user: UserRow): PublicUserDto => {
  const handle = user.username;
  const name = user.username; // displayName field doesn't exist yet
  const rating = Math.round(user.rating);
  return {
    id: user.id,
    name,
    handle,
    initials: initialsOf(handle),
    rating,
    rank: rankOf(rating),
  };
};

export const toPlayerProfile = (
  user: UserRow,
  progress?: { level: number; xp: number; xpGoal: number; streak: number; peakRating: number } | null,
): PlayerProfileDto => {
  const pub = toPublicUser(user);
  const peak = progress?.peakRating ? Math.round(progress.peakRating) : pub.rating;
  return {
    ...pub,
    level: progress?.level ?? 1,
    xp: progress?.xp ?? 0,
    xpGoal: progress?.xpGoal ?? 1000,
    winRate: user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0,
    wins: user.wins,
    losses: user.losses,
    streak: progress?.streak ?? 0,
    peak,
    battles: user.gamesPlayed,
    bio: user.bio,
    location: user.location,
    visibility: "public", // visibility field doesn't exist yet in schema
  };
};

export const toUiVerdict = (verdict: string): UiVerdict => {
  switch (verdict) {
    case "accepted":
      return "Accepted";
    case "wrong_answer":
      return "Wrong Answer";
    case "time_limit_exceeded":
      return "Time Limit Exceeded";
    case "memory_limit_exceeded":
      return "Memory Limit Exceeded";
    case "runtime_error":
      return "Runtime Error";
    case "compilation_error":
      return "Compilation Error";
    default:
      return "Internal Error";
  }
};

export const toneForRank = (rank: string) => {
  switch (rank) {
    case "Gold":
      return "amber";
    case "Platinum":
      return "lime";
    case "Diamond":
      return "blue";
    case "Master":
    case "Grandmaster":
      return "red";
    default:
      return "stone";
  }
};
