-- 0004_progress_quests_social.sql
-- Create tables for quest definitions, user quests, and user progress.

CREATE TABLE IF NOT EXISTS quest_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  target_type TEXT NOT NULL, -- 'win', 'solve', 'battle'
  target_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES quest_definitions(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_id, assigned_date)
);

CREATE TABLE IF NOT EXISTS user_progress (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  xp_goal INTEGER NOT NULL DEFAULT 1000,
  streak INTEGER NOT NULL DEFAULT 0,
  peak_rating DOUBLE PRECISION NOT NULL DEFAULT 1500,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
