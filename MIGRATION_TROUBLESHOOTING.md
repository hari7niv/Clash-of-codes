# Migration Troubleshooting Guide

## The Problem

Room creation (and other operations) failing with constraint errors like:
- "violates check constraint rooms_time_control_valid"
- "column does not exist"
- "null value in column violates not-null constraint"

**Root Cause:** Migration files exist in the codebase but haven't been run against your local database. The code expects the updated schema, but the database still has the old schema.

## Quick Fix (90% of cases)

```bash
# From workspace root
pnpm migrate
```

Then restart your services.

## Verification Steps

### Step 1: Check Migration Status

```bash
# See which migrations have been applied
pnpm migrate:verify
```

This shows:
- ✅ Which migrations are applied
- ⏳ Which migrations are pending
- Specific constraint checks

**Expected output:**
```
📊 Migration Status:

File                                    | Status         | Applied At
--------------------------------------------------------------------------------
0001_init.sql                           | ✅ Applied     | 2024-01-15T10:30:00.000Z
0002_auth_tokens_profiles.sql           | ✅ Applied     | 2024-01-15T10:30:01.000Z
0002_update_time_control_values.sql     | ✅ Applied     | 2024-01-15T10:30:02.000Z
0003_add_user_preferences.sql           | ✅ Applied     | 2024-01-15T10:30:03.000Z
0003_room_fields_and_membership.sql     | ✅ Applied     | 2024-01-15T10:30:04.000Z
0004_progress_quests_social.sql         | ✅ Applied     | 2024-01-15T10:30:05.000Z
0005_indexes_constraints.sql            | ✅ Applied     | 2024-01-15T10:30:06.000Z

Summary: 7 applied, 0 pending

✅ All migrations are up to date!

🔍 Checking critical constraints...

✅ rooms.time_control constraint exists:
   CHECK (time_control IN ('blitz', 'standard', 'deep'))
   ✅ Constraint has correct values (blitz, standard, deep)
```

### Step 2: Run Pending Migrations

If you see pending migrations:

```bash
pnpm migrate
```

**Expected output:**
```
skip   0001_init.sql
skip   0002_auth_tokens_profiles.sql
apply  0002_update_time_control_values.sql
apply  0003_add_user_preferences.sql
apply  0003_room_fields_and_membership.sql
skip   0004_progress_quests_social.sql
skip   0005_indexes_constraints.sql

Done. Applied 3 migration(s), 4 already up to date.
```

### Step 3: Verify Constraints Directly in Database

Connect to PostgreSQL and run:

```sql
-- Check rooms.time_control constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint
WHERE conrelid = 'rooms'::regclass 
  AND conname = 'rooms_time_control_valid';
```

**Expected result:**
```
conname: rooms_time_control_valid
pg_get_constraintdef: CHECK (time_control = ANY (ARRAY['blitz'::text, 'standard'::text, 'deep'::text]))
```

If you see `'rapid'` or `'extended'` instead, the migration didn't run.

### Step 4: Verify Applied Migrations in Database

```sql
-- Check which migrations are recorded as applied
SELECT filename, applied_at 
FROM schema_migrations 
ORDER BY filename;
```

This table tracks which migrations have run. If a migration file exists in `infra/migrations/` but isn't in this table, it hasn't been applied.

## Common Issues

### Issue 1: "Migration already applied" but constraint is still wrong

**Cause:** Migration was marked as applied but failed mid-execution (before the transaction committed).

**Fix:**
1. Manually remove the migration from tracking:
   ```sql
   DELETE FROM schema_migrations 
   WHERE filename = '0002_update_time_control_values.sql';
   ```

2. Re-run migrations:
   ```bash
   pnpm migrate
   ```

### Issue 2: Multiple migration files with same prefix (0002_*, 0003_*)

**This is intentional.** Files are applied in alphabetical order:
- `0002_auth_tokens_profiles.sql`
- `0002_update_time_control_values.sql`
- `0003_add_user_preferences.sql`
- `0003_room_fields_and_membership.sql`

Both `0002_*` files are independent and can coexist.

### Issue 3: "Table does not exist" errors

**Cause:** Initial migration (`0001_init.sql`) hasn't run.

**Fix:**
```bash
pnpm migrate
```

This creates all tables from scratch.

### Issue 4: Migration fails with "already exists" error

**Cause:** Partial schema exists from manual changes or interrupted migrations.

**Fix (DESTRUCTIVE - only for development):**
```bash
# Drop and recreate database
docker compose down -v
docker compose up -d
pnpm migrate
pnpm seed
```

**Warning:** This deletes ALL data. Only use in development.

## Automatic Validation

The API server now performs schema validation on startup. If migrations are pending, you'll see:

```
═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL SCHEMA VALIDATION ERRORS DETECTED 🚨
═══════════════════════════════════════════════════════════════════════════════

The database schema does NOT match what the code expects.
This will cause runtime errors when creating rooms, updating users, etc.

❌ rooms.time_control constraint
   Expected: CHECK (time_control IN ('blitz', 'standard', 'deep'))
   Actual:   CHECK (time_control IN ('rapid', 'blitz', 'extended'))

❌ Required migrations
   Expected: 0002_update_time_control_values.sql, 0003_add_user_preferences.sql
   Actual:   Missing: 0002_update_time_control_values.sql

🔧 TO FIX: Run pending migrations from the workspace root:
   pnpm migrate

Then restart this server.
═══════════════════════════════════════════════════════════════════════════════

⚠️  Server will continue starting but WILL HAVE RUNTIME ERRORS
```

**Action:** Don't ignore this. Run `pnpm migrate` immediately.

## Testing After Migration

1. **Start all services:**
   ```bash
   pnpm dev:api
   pnpm dev:match
   pnpm dev:judge
   ```

2. **Test room creation:**
   - Navigate to `/rooms/create` in frontend
   - Fill out form with default settings
   - Click "Create Room"
   - Should succeed with a room code (e.g., "ABCD1234")
   - Should NOT see "violates check constraint" error

3. **Test user preferences:**
   - Navigate to `/settings`
   - Change language, theme, notifications
   - Click "Save"
   - Should succeed without errors

## Migration Workflow Best Practices

### After Pulling New Code

Always run:
```bash
git pull
pnpm install  # Update dependencies
pnpm migrate  # Apply new migrations
```

### Before Committing Schema Changes

If you modified database schema:

1. **Create a new migration file:**
   ```bash
   # Name format: ####_description.sql
   # Example: 0006_add_user_badges.sql
   touch infra/migrations/0006_add_user_badges.sql
   ```

2. **Write idempotent SQL:**
   ```sql
   -- Use IF EXISTS/IF NOT EXISTS for safety
   ALTER TABLE users ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;
   
   -- Drop constraints safely
   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_rating_positive;
   
   -- Add constraints
   ALTER TABLE users ADD CONSTRAINT users_rating_positive CHECK (rating >= 0);
   ```

3. **Test migration:**
   ```bash
   pnpm migrate
   pnpm migrate:verify
   ```

4. **Commit migration file with code changes:**
   ```bash
   git add infra/migrations/0006_add_user_badges.sql
   git add services/api/src/routes/users/user.routes.ts
   git commit -m "Add user badges feature"
   ```

### Working Across Multiple Branches

If you switch branches with different schema versions:

1. **Check current migration state:**
   ```bash
   pnpm migrate:verify
   ```

2. **If migrations differ:**
   ```bash
   # Option 1: Reset database (development only)
   docker compose down -v
   docker compose up -d
   pnpm migrate
   pnpm seed
   
   # Option 2: Manually remove conflicting migrations
   # Connect to psql and DELETE FROM schema_migrations WHERE ...
   ```

## Available Commands

| Command | Purpose |
|---------|---------|
| `pnpm migrate` | Apply pending migrations |
| `pnpm migrate:verify` | Check migration status and constraints |
| `pnpm migrate:check` | Check for migration files (existing command) |
| `pnpm seed` | Seed database with test data |

## SQL Snippets for Manual Inspection

```sql
-- List all migrations applied
SELECT * FROM schema_migrations ORDER BY applied_at;

-- Check rooms table structure
\d rooms

-- Check users table structure  
\d users

-- List all constraints on rooms table
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint
WHERE conrelid = 'rooms'::regclass;

-- Check specific column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'preferred_language';
```

## When to Ask for Help

If after running `pnpm migrate`:
- ❌ Verification still shows pending migrations
- ❌ Constraints are still incorrect
- ❌ Room creation still fails
- ❌ Migration script reports errors

Then:
1. Share output of `pnpm migrate:verify`
2. Share output of `pnpm migrate`
3. Share relevant error messages from API server logs

## Summary

**Quick checklist after pulling code:**
1. ✅ `pnpm install`
2. ✅ `pnpm migrate`
3. ✅ `pnpm migrate:verify` (confirms success)
4. ✅ Restart services
5. ✅ Test room creation

**If room creation fails:**
1. Check API server startup logs for schema validation warnings
2. Run `pnpm migrate:verify` to see what's missing
3. Run `pnpm migrate` to apply pending migrations
4. Verify with `pnpm migrate:verify` again
5. Restart API server

The new automatic validation should catch these issues immediately at startup, making them much easier to spot and fix.
