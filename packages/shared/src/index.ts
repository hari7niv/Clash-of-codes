/**
 * @clashofcode/shared — types, validation, constants, and the rating algorithm
 * imported by all three services. Types first, so api & match-server never drift
 * apart on the WS contract.
 */

// Types
export * from './types/user';
export * from './types/problem';
export * from './types/match';
export * from './types/submission';
export * from './types/socket-events';

// Zod schemas
export * from './schemas/auth.schema';
export * from './schemas/submission.schema';
export * from './schemas/room.schema';

// Constants
export * from './constants/rank-tiers';
export * from './constants/time-controls';

// Rating
export * from './rating/glicko2';
