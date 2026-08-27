-- 0001_init.sql — ClashOfCode initial schema.
-- This file (and its siblings in this directory) is the SCHEMA SOURCE OF TRUTH.
-- Apply with: pnpm migrate

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- users --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username          TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  rating            DOUBLE PRECISION NOT NULL DEFAULT 1500,
  rating_deviation  DOUBLE PRECISION NOT NULL DEFAULT 350,
  rating_volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  games_played      INTEGER NOT NULL DEFAULT 0,
  wins              INTEGER NOT NULL DEFAULT 0,
  losses            INTEGER NOT NULL DEFAULT 0,
  draws             INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users (rating DESC);

-- problems -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problems (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  statement       TEXT NOT NULL,
  difficulty      TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  rating          INTEGER NOT NULL DEFAULT 1200,
  time_limit_ms   INTEGER NOT NULL DEFAULT 2000,
  memory_limit_kb INTEGER NOT NULL DEFAULT 262144,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems (difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_rating ON problems (rating);

-- test_cases ---------------------------------------------------------------
-- Hidden test cases never leave the judge/DB; only is_sample=true rows are
-- surfaced to clients (see PublicProblem in @clashofcode/shared).
CREATE TABLE IF NOT EXISTS test_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id      UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input           TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_sample       BOOLEAN NOT NULL DEFAULT false,
  ordinal         INTEGER NOT NULL,
  UNIQUE (problem_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_test_cases_problem ON test_cases (problem_id, ordinal);

-- matches ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id    UUID NOT NULL REFERENCES problems(id),
  mode          TEXT NOT NULL CHECK (mode IN ('ranked','casual','room','practice')),
  status        TEXT NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting','active','judging','completed','abandoned')),
  player_one_id UUID NOT NULL REFERENCES users(id),
  player_two_id UUID REFERENCES users(id),
  winner_id     UUID REFERENCES users(id),
  room_code     TEXT,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_matches_player_one ON matches (player_one_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_two ON matches (player_two_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);

-- submissions --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID REFERENCES matches(id) ON DELETE SET NULL,
  user_id      UUID NOT NULL REFERENCES users(id),
  problem_id   UUID NOT NULL REFERENCES problems(id),
  language     TEXT NOT NULL,
  source_code  TEXT NOT NULL,
  verdict      TEXT NOT NULL DEFAULT 'pending'
               CHECK (verdict IN ('pending','accepted','wrong_answer','time_limit_exceeded',
                                  'memory_limit_exceeded','runtime_error','compilation_error','internal_error')),
  passed_tests INTEGER NOT NULL DEFAULT 0,
  total_tests  INTEGER NOT NULL DEFAULT 0,
  runtime_ms   INTEGER,
  memory_kb    INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  judged_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_match ON submissions (match_id);

-- ratings_history ----------------------------------------------------------
-- UNIQUE(user_id, match_id) is what makes rating application idempotent:
-- a retried COMPLETED transition can't double-apply a delta (Architecture §4.4).
CREATE TABLE IF NOT EXISTS ratings_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rating_before DOUBLE PRECISION NOT NULL,
  rating_after  DOUBLE PRECISION NOT NULL,
  rd_before     DOUBLE PRECISION NOT NULL,
  rd_after      DOUBLE PRECISION NOT NULL,
  vol_before    DOUBLE PRECISION NOT NULL,
  vol_after     DOUBLE PRECISION NOT NULL,
  delta         DOUBLE PRECISION NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_history_user ON ratings_history (user_id, created_at DESC);

-- rooms (code lobbies) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id   UUID REFERENCES problems(id),
  is_private   BOOLEAN NOT NULL DEFAULT true,
  max_players  INTEGER NOT NULL DEFAULT 2,
  time_control TEXT NOT NULL DEFAULT 'rapid',
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','starting','in_progress','closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);

CREATE TABLE IF NOT EXISTS room_members (
  room_id   UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- social: friends / blocks (minimal, backs the social routes) --------------
CREATE TABLE IF NOT EXISTS friendships (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);

-- keep users.updated_at fresh ----------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
