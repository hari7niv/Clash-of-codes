-- Notifications table for in-app alerts (FR-13.1)
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "href" text,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications"("user_id", "read");

-- Paste events table for anti-cheat logging (FR-15.2)
CREATE TABLE IF NOT EXISTS "paste_events" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "match_id" uuid NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pasted_text" text NOT NULL,
  "language" text NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "paste_events_match_id_idx" ON "paste_events"("match_id");
CREATE INDEX IF NOT EXISTS "paste_events_user_id_idx" ON "paste_events"("user_id");
