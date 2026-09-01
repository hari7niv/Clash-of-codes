/**
 * Match-server database schema.
 * Reexports from services/api or defines match-specific views.
 * For now, we reference the canonical schema definitions.
 */

// Note: In production, we'd import from a shared schema package.
// For now, match-server reads from the same PostgreSQL instance as services/api.
// The actual table definitions (matches, submissions, users, problems) are defined
// in services/api/src/db/schema/. This file exists as a placeholder for any
// match-server-specific views or helpers.

export const MATCH_TIMEOUT_MS = 300_000; // 5 minutes
export const DISCONNECT_GRACE_PERIOD_MS = 60_000; // 60 seconds
