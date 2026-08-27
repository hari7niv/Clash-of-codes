/** Rank tiers derived from Glicko-2 rating. */

export interface RankTier {
  name: string;
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound. */
  max: number;
  /** Hex color for UI badges. */
  color: string;
}

export const RANK_TIERS: readonly RankTier[] = [
  { name: 'Bronze', min: 0, max: 1199, color: '#cd7f32' },
  { name: 'Silver', min: 1200, max: 1399, color: '#c0c0c0' },
  { name: 'Gold', min: 1400, max: 1599, color: '#ffd700' },
  { name: 'Platinum', min: 1600, max: 1799, color: '#5ad1e6' },
  { name: 'Diamond', min: 1800, max: 1999, color: '#4aa3ff' },
  { name: 'Master', min: 2000, max: 2299, color: '#b14aff' },
  { name: 'Grandmaster', min: 2300, max: Number.POSITIVE_INFINITY, color: '#ff4a4a' },
] as const;

export function tierForRating(rating: number): RankTier {
  for (const tier of RANK_TIERS) {
    if (rating >= tier.min && rating <= tier.max) return tier;
  }
  // Below the lowest bound -> lowest tier.
  return RANK_TIERS[0];
}
