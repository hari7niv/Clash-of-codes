ALTER TABLE "submissions" ALTER COLUMN "match_id" DROP NOT NULL;
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "test_results" jsonb;
ALTER TABLE "problems" ADD COLUMN IF NOT EXISTS "examples" jsonb DEFAULT '[]' NOT NULL;
ALTER TABLE "problems" ADD COLUMN IF NOT EXISTS "constraints" jsonb DEFAULT '[]' NOT NULL;
