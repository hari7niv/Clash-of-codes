-- Tournaments (FR-10.1 - 10.5)
CREATE TABLE IF NOT EXISTS "tournaments" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "format" text NOT NULL DEFAULT 'single_elimination',
  "status" text NOT NULL DEFAULT 'upcoming',
  "max_participants" integer NOT NULL DEFAULT 16,
  "start_time" timestamptz,
  "end_time" timestamptz,
  "prize_description" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tournament_participants" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "seed" integer,
  "eliminated" boolean DEFAULT false NOT NULL,
  "final_rank" integer,
  "registered_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE("tournament_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "tournament_matches" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
  "round" integer NOT NULL,
  "match_number" integer NOT NULL,
  "player_one_id" uuid REFERENCES "users"("id"),
  "player_two_id" uuid REFERENCES "users"("id"),
  "winner_id" uuid REFERENCES "users"("id"),
  "game_match_id" uuid,
  "status" text NOT NULL DEFAULT 'pending',
  "scheduled_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tournament_participants_tournament_idx" ON "tournament_participants"("tournament_id");
CREATE INDEX IF NOT EXISTS "tournament_matches_tournament_idx" ON "tournament_matches"("tournament_id");
