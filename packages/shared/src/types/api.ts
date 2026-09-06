/**
 * DTOs the REST API returns to the ClashOfCode frontend.
 * Field names match pages/hooks (name/handle/initials/rank), not the DB column names.
 */

export type RankName =
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Master'
  | 'Grandmaster';

export interface PublicUserDto {
  id: string;
  name: string;
  handle: string;
  initials: string;
  rating: number;
  rank: RankName;
}

export interface PlayerProfileDto extends PublicUserDto {
  level: number;
  xp: number;
  xpGoal: number;
  winRate: number;
  wins: number;
  losses: number;
  streak: number;
  peak: number;
  battles: number;
  bio?: string | null;
  location?: string | null;
  visibility?: 'public' | 'friends' | 'private';
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export type UiVerdict =
  | 'Accepted'
  | 'WrongAnswer'
  | 'TimeLimitExceeded'
  | 'MemoryLimitExceeded'
  | 'RuntimeError'
  | 'CompileError'
  | 'Pending';
