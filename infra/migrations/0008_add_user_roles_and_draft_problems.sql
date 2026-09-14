ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;
ALTER TABLE "problems" ADD COLUMN "is_draft" boolean DEFAULT true NOT NULL;
