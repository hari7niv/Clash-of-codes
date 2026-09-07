-- Profile display fields + room lobby flags the frontend actually sends.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_progress BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE room_members
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alias TEXT;
