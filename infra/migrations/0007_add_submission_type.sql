-- 0007_add_submission_type.sql
-- Add submission_type column to distinguish competitive submissions from test runs
--
-- submission_type:
--   'competitive' - Full submission eligible for match completion and winner determination
--   'test_run'    - Sample test run, not eligible for competitive scoring
--
-- This prevents test runs from incorrectly determining match winners

ALTER TABLE submissions
ADD COLUMN submission_type TEXT NOT NULL DEFAULT 'competitive'
CHECK (submission_type IN ('competitive', 'test_run'));

-- Add index for efficient filtering during winner determination
CREATE INDEX idx_submissions_match_competitive 
ON submissions (match_id, submission_type, verdict, passed_tests DESC, created_at ASC)
WHERE submission_type = 'competitive';

-- Backfill: All existing submissions are assumed competitive
-- (Safe because no Run functionality existed before this migration)
UPDATE submissions SET submission_type = 'competitive' WHERE submission_type IS NULL;
