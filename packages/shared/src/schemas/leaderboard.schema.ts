import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

/** Docs use `scope`; the Leaderboard page sends `tab`. Accept both. */
export const leaderboardQuerySchema = paginationQuerySchema.extend({
  scope: z.string().optional(),
  tab: z.string().optional(),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export function normalizeLeaderboardScope(raw?: string): 'global' | 'friends' | 'weekly' | 'rising' {
  const value = (raw ?? 'global').trim().toLowerCase();
  if (value === 'friends') return 'friends';
  if (value === 'weekly') return 'weekly';
  if (value === 'rising' || value === 'rising stars') return 'rising';
  return 'global';
}
