/**
 * Glicko-2 rating system — the pure, IO-free algorithm.
 *
 * This is the "same one the API uses" referenced in the battle flow: api's
 * rating.service.ts and match-server's rating.trigger.ts both call into here, so
 * the maths lives in exactly one place. The services only handle loading ratings
 * from Postgres and persisting the result.
 *
 * Reference: Glickman, "Example of the Glicko-2 system" (2013).
 */

export interface Glicko2Rating {
  /** r — human-readable rating (default 1500). */
  rating: number;
  /** RD — rating deviation (default 350). */
  deviation: number;
  /** sigma — volatility (default 0.06). */
  volatility: number;
}

export interface Glicko2Match {
  opponentRating: number;
  opponentDeviation: number;
  /** 1 = win, 0.5 = draw, 0 = loss. */
  score: number;
}

export const DEFAULT_RATING = 1500;
export const DEFAULT_DEVIATION = 350;
export const DEFAULT_VOLATILITY = 0.06;

/** System constant: smaller = ratings change less abruptly. Typical 0.3–1.2. */
const TAU = 0.5;
const SCALE = 173.7178;
const CONVERGENCE = 1e-6;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

export function defaultRating(): Glicko2Rating {
  return {
    rating: DEFAULT_RATING,
    deviation: DEFAULT_DEVIATION,
    volatility: DEFAULT_VOLATILITY,
  };
}

/**
 * Compute a player's new rating after a set of matches within a rating period.
 * For 1v1 battles this array has exactly one entry.
 */
export function updateRating(player: Glicko2Rating, matches: Glicko2Match[]): Glicko2Rating {
  const mu = (player.rating - DEFAULT_RATING) / SCALE;
  const phi = player.deviation / SCALE;
  const sigma = player.volatility;

  // No games played this period: only the deviation grows.
  if (matches.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: player.rating,
      deviation: phiStar * SCALE,
      volatility: sigma,
    };
  }

  // Step 3 & 4: estimated variance (v) and improvement (delta).
  let vInv = 0;
  let deltaSum = 0;
  for (const m of matches) {
    const muJ = (m.opponentRating - DEFAULT_RATING) / SCALE;
    const phiJ = m.opponentDeviation / SCALE;
    const gj = g(phiJ);
    const e = expectedScore(mu, muJ, phiJ);
    vInv += gj * gj * e * (1 - e);
    deltaSum += gj * (m.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Step 5: iterate to the new volatility (Illinois algorithm).
  const a = Math.log(sigma * sigma);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const d2 = delta * delta;
    const numerator = ex * (d2 - phi * phi - v - ex);
    const denominator = 2 * Math.pow(phi * phi + v + ex, 2);
    return numerator / denominator - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > CONVERGENCE) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newVolatility = Math.exp(A / 2);

  // Steps 6 & 7: new deviation and rating.
  const phiStar = Math.sqrt(phi * phi + newVolatility * newVolatility);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: newMu * SCALE + DEFAULT_RATING,
    deviation: newPhi * SCALE,
    volatility: newVolatility,
  };
}

export type MatchOutcome = 'player_one' | 'player_two' | 'draw';

export interface MatchRatingResult {
  playerOne: Glicko2Rating;
  playerTwo: Glicko2Rating;
}

/** Convenience: update both players of a single 1v1 battle at once. */
export function computeMatchRatings(
  playerOne: Glicko2Rating,
  playerTwo: Glicko2Rating,
  outcome: MatchOutcome,
): MatchRatingResult {
  const s1 = outcome === 'player_one' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const s2 = outcome === 'player_two' ? 1 : outcome === 'draw' ? 0.5 : 0;

  return {
    playerOne: updateRating(playerOne, [
      { opponentRating: playerTwo.rating, opponentDeviation: playerTwo.deviation, score: s1 },
    ]),
    playerTwo: updateRating(playerTwo, [
      { opponentRating: playerOne.rating, opponentDeviation: playerOne.deviation, score: s2 },
    ]),
  };
}
