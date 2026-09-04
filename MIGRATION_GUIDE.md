# Database Migration Guide

## What Are Migrations?

Database migrations are versioned SQL scripts that evolve your database schema over time. Each migration file in `infra/migrations/` represents a set of schema changes applied in order.

## Why Migrations Fail Silently

Migration files sitting in the repository **don't apply themselves**. You must explicitly run `pnpm migrate` to apply them to your local database. If you skip this step, you'll encounter cryptic runtime errors.

## Common Symptoms of Missing Migrations

### Room Creation Fails with "missing value" or constraint violation

**Error**: `Error: new row for relation "rooms" violates check constraint "rooms_time_control_valid"`

**Cause**: Your database still has the old CHECK constraint that expects `('blitz', 'rapid', 'extended')`, but the code now uses `('blitz', 'standard', 'deep')`.

**Fix**: Migration `0002_update_time_control_values.sql` updates this constraint. Run `pnpm migrate`.

### Settings Page Fails to Save Preferences

**Error**: `Error: column "rating_visible" does not exist` or similar for other preference fields

**Cause**: Your users table is missing the 8 new preference columns added for the settings page.

**Fix**: Migration `0003_add_user_preferences.sql` adds these columns. Run `pnpm migrate`.

## How to Run Migrations

### Prerequisites

1. **PostgreSQL must be running**:
   ```bash
   pnpm docker:up
   ```
   
2. **Verify connection**:
   Check that `DATABASE_URL` in your `.env` files points to the running database:
   ```
   postgres://clash:clash@localhost:5440/clashofcode
   ```

### Apply All Pending Migrations

```bash
pnpm migrate
```

**Expected output:**
```
skip   0001_init.sql
apply  0002_auth_tokens_profiles.sql
apply  0002_update_time_control_values.sql
apply  0003_add_user_preferences.sql
apply  0003_room_fields_and_membership.sql

Done. Applied 4 migration(s), 2 already up to date.
```

### Check Migration Status

```bash
pnpm migrate:check
```

**Output if up to date:**
```
📋 Migration Status
==================

Applied: 7 migration(s)
  ✓ 0001_init.sql
  ✓ 0002_auth_tokens_profiles.sql
  ✓ 0002_update_time_control_values.sql
  ✓ 0003_add_user_preferences.sql
  ✓ 0003_room_fields_and_membership.sql
  ✓ 0004_progress_quests_social.sql
  ✓ 0005_indexes_constraints.sql

✅ Database is up to date!
```

**Output if behind:**
```
📋 Migration Status
==================

Applied: 3 migration(s)
  ✓ 0001_init.sql
  ✓ 0002_auth_tokens_profiles.sql
  ✓ 0002_update_time_control_values.sql

⚠️  Pending: 4 migration(s)
  ⚠  0003_add_user_preferences.sql
  ⚠  0003_room_fields_and_membership.sql
  ⚠  0004_progress_quests_social.sql
  ⚠  0005_indexes_constraints.sql

❌ Database is OUT OF DATE!
   Run: pnpm migrate
```

## Current Migrations (as of latest)

| File | Description | Status | Applied Date |
|------|-------------|--------|--------------|
| `0001_init.sql` | Initial schema | ✅ Applied | 2026-08-30 |
| `0002_auth_tokens_profiles.sql` | Auth tokens | ✅ Applied | 2026-08-30 |
| `0002_update_time_control_values.sql` | **Time control constraint** | ✅ Applied | 2026-09-03 |
| `0003_add_user_preferences.sql` | **User preferences** | ✅ Applied | 2026-09-03 |
| `0003_room_fields_and_membership.sql` | Room fields | ✅ Applied | 2026-08-30 |
| `0004_progress_quests_social.sql` | Progress tracking | ✅ Applied | 2026-08-30 |
| `0005_indexes_constraints.sql` | Performance indexes | ✅ Applied | 2026-08-30 |

**All migrations applied successfully!** Room creation with "Standard" tempo and Settings page preferences are now working.

## After Pulling Changes

**Always run** after pulling changes that add new migration files:

```bash
git pull
pnpm migrate:check  # Check if migrations needed
pnpm migrate        # Apply any pending migrations
```

## How Migrations Work

### Migration Script (`infra/scripts/migrate.ts`)

1. Connects to PostgreSQL
2. Creates `schema_migrations` table if it doesn't exist
3. Reads all `.sql` files from `infra/migrations/`
4. Sorts them alphabetically (hence the `0001_`, `0002_` prefixes)
5. Checks which files are already applied
6. Applies each new migration in a transaction
7. Records the filename in `schema_migrations` to prevent re-application

### Migration Tracking Table

```sql
CREATE TABLE schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Query to see what's been applied:
```sql
SELECT filename, applied_at 
FROM schema_migrations 
ORDER BY filename;
```

## Troubleshooting

### "ECONNREFUSED" when running migrations

**Problem**: PostgreSQL isn't running or wrong connection details.

**Solution**:
1. Start Docker: `pnpm docker:up`
2. Verify DATABASE_URL in `.env` files
3. Check Docker container is healthy: `docker ps`

### Migration fails partway through

**Problem**: SQL error in a migration file.

**Solution**:
1. Each migration runs in a transaction and rolls back on error
2. Fix the SQL in the migration file
3. Re-run `pnpm migrate`
4. If the file was already partially applied, you may need to manually clean up

### Need to manually inspect database

**Using psql (if installed)**:
```bash
PGPASSWORD=clash psql -h localhost -p 5440 -U clash -d clashofcode
```

**Using Docker exec**:
```bash
docker exec -it <container_id> psql -U clash -d clashofcode
```

**Verify room constraint**:
```sql
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'rooms'::regclass 
AND conname = 'rooms_time_control_valid';
```

Should show: `CHECK ((time_control = ANY (ARRAY['blitz'::text, 'standard'::text, 'deep'::text])))`

**Verify user preferences columns**:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
  'rating_visible', 
  'activity_visible', 
  'quick_queue', 
  'reduced_motion',
  'match_found_notifications',
  'direct_invites',
  'weekly_review',
  'discoverable'
);
```

Should return 8 rows.

## Creating New Migrations

When you need to change the schema:

1. **Create a new file** in `infra/migrations/`:
   ```
   0006_your_description.sql
   ```

2. **Write the SQL**:
   ```sql
   -- 0006_your_description.sql
   -- Brief description of what this changes
   
   ALTER TABLE your_table
   ADD COLUMN your_column TEXT;
   ```

3. **Test it**:
   ```bash
   pnpm migrate:check  # Should show as pending
   pnpm migrate        # Apply it
   ```

4. **Commit both** the migration file and any code changes together

## Best Practices

1. ✅ **Always use transactions** - the migration script handles this automatically
2. ✅ **Make migrations reversible** when possible (document rollback steps)
3. ✅ **Test migrations** on a copy of production data before deploying
4. ✅ **Never edit applied migrations** - create a new migration instead
5. ✅ **Keep migrations small** - one logical change per file
6. ✅ **Add comments** explaining why the change was needed

## Emergency Rollback

If a migration breaks production:

1. **Don't panic** - each migration is transactional
2. **Create a rollback migration** that reverses the changes
3. **Apply the rollback**: `pnpm migrate`

Example rollback for `0002_update_time_control_values.sql`:
```sql
-- 0006_rollback_time_control.sql
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_time_control_valid;
ALTER TABLE rooms
ADD CONSTRAINT rooms_time_control_valid
CHECK (time_control IN ('blitz', 'rapid', 'extended'));
```

## Verifying Room Creation Fix

After running migrations, test room creation:

1. Start all services
2. Navigate to `/rooms/create`
3. Fill in room details with **"Standard" battle tempo** (this was failing before)
4. Click "Create room"
5. Should see: "Your room is live" with a room code (e.g., `CLO-A1B2`)
6. No error toast about "missing value" or constraint violations

## Verifying Settings Fix

After running migrations, test settings page:

1. Navigate to `/settings`
2. Toggle any preference (e.g., "Show rating on profile")
3. Change bio text
4. Click "Save changes"
5. Refresh the page
6. Changes should persist (not reset to defaults)
