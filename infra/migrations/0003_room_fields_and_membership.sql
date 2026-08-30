-- 0003_room_fields_and_membership.sql
-- Add room_name, topic, rule_note, and rules fields to rooms table.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'Random',
  ADD COLUMN IF NOT EXISTS rule_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rules TEXT[] DEFAULT '{}'::TEXT[];
