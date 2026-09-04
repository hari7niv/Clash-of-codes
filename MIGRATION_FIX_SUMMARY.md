# Migration Validation Fix Summary

## Problem

Room creation (and other features) failing with constraint violations because migration files exist in the codebase but haven't been run against the local database.

**Symptoms:**
- "violates check constraint rooms_time_control_valid"
- Room creation insert fails
- Code expects schema that doesn't match database

**Root Cause:** Migration files are just files until `pnpm migrate` is run. Having them in git doesn't automatically update the database.

## Solutions Implemented

### 1. Automatic Startup Validation ✅

Added schema validation that runs every time the API server starts.

**What it checks:**
- ✅ `rooms.time_control` constraint has correct values (blitz, standard, deep)
- ✅ Required migrations are applied (0002, 0003 files)
- ✅ User preferences columns exist
- ✅ Critical database structure matches code expectations

**What you see on startup:**

If migrations are missing, you'll get a **loud, unmissable warning**:

```
═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL SCHEMA VALIDATION ERRORS DETECTED 🚨
═══════════════════════════════════════════════════════════════════════════════

The database schema does NOT match what the code expects.
This will cause runtime errors when creating rooms, updating users, etc.

❌ rooms.time_control constraint
   Expected: CHECK (time_control IN ('blitz', 'standard', 'deep'))
   Actual:   CHECK (time_control IN ('rapid', 'blitz', 'extended'))

🔧 TO FIX: Run pending migrations from the workspace root:
   pnpm migrate

Then restart this server.
═══════════════════════════════════════════════════════════════════════════════
```

**Server behavior:** Continues to start (to avoid breaking dev workflow) but shows clear warnings. You should fix immediately.

### 2. Migration Verification Command ✅

New command to check migration status without modifying anything:

```bash
pnpm migrate:verify
```

**Shows:**
- Which migrations are applied ✅
- Which migrations are pending ⏳
- Current constraint definitions
- Human-readable summary

**Example output:**
```
📊 Migration Status:

File                                    | Status         | Applied At
--------------------------------------------------------------------------------
0001_init.sql                           | ✅ Applied     | 2024-01-15T10:30:00Z
0002_auth_tokens_profiles.sql           | ✅ Applied     | 2024-01-15T10:30:01Z
0002_update_time_control_values.sql     | ⏳ PENDING     | -
0003_add_user_preferences.sql           | ⏳ PENDING     | -

Summary: 2 applied, 2 pending

⚠️  You have pending migrations!
   Run 'pnpm migrate' to apply them.

✅ rooms.time_control constraint exists:
   CHECK (time_control IN ('blitz', 'standard', 'deep'))
```

### 3. Comprehensive Documentation ✅

Created `MIGRATION_TROUBLESHOOTING.md` with:
- Step-by-step verification process
- Common issues and fixes
- SQL snippets for manual inspection
- Migration workflow best practices
- When to ask for help

### 4. Updated Quick Start Guide ✅

Updated `QUICK_START.md` to include:
- `pnpm migrate:verify` in post-pull checklist
- Reference to migration troubleshooting
- Mention of automatic validation

## Files Created/Modified

### New Files
- ✅ `services/api/src/utils/schema-validation.ts` - Startup validation logic
- ✅ `infra/scripts/verify-migrations.ts` - Migration verification script
- ✅ `MIGRATION_TROUBLESHOOTING.md` - Complete troubleshooting guide
- ✅ `MIGRATION_FIX_SUMMARY.md` - This file

### Modified Files
- ✅ `services/api/src/index.ts` - Added schema validation on startup
- ✅ `package.json` - Added `migrate:verify` command
- ✅ `infra/package.json` - Added `migrate:verify` script
- ✅ `QUICK_START.md` - Updated with verification steps

## How to Use

### Immediate Fix for Current Issue

```bash
# 1. Verify what's wrong
pnpm migrate:verify

# 2. Apply pending migrations
pnpm migrate

# 3. Confirm fix
pnpm migrate:verify

# 4. Restart API server
```

### Daily Workflow

After pulling new code:
```bash
git pull
pnpm install
pnpm migrate        # Apply any new migrations
pnpm migrate:verify # Confirm they applied
# Restart services
```

The API server will now warn you if you forget the migrate step.

### When Creating Rooms

Just use the app normally. If migrations are missing:
1. API server startup logs will show validation errors
2. Room creation will fail
3. Logs point you to run `pnpm migrate`

No more cryptic "constraint violation" errors without context.

## Validation Checks Performed

The startup validation checks:

### 1. rooms.time_control Constraint
**Severity:** Error (blocks room creation)

Checks that constraint allows: `blitz`, `standard`, `deep`
Does NOT allow old values: `rapid`, `extended`

**Fixed by:** Migration `0002_update_time_control_values.sql`

### 2. Required Migrations Applied
**Severity:** Error

Checks that these critical migrations are applied:
- `0002_update_time_control_values.sql`
- `0003_add_user_preferences.sql`
- `0003_room_fields_and_membership.sql`

### 3. User Preferences Columns
**Severity:** Warning (non-critical feature)

Checks that users table has:
- `preferred_language`
- `editor_theme`
- `notifications_enabled`

**Fixed by:** Migration `0003_add_user_preferences.sql`

## Benefits

### Before This Fix
- ❌ Migration issues discovered at runtime
- ❌ Cryptic constraint violation errors
- ❌ No way to check migration status
- ❌ Unclear which migration fixes which issue
- ❌ Easy to forget to run migrations after pull

### After This Fix
- ✅ Issues discovered at server startup
- ✅ Clear error messages with fix instructions
- ✅ Easy command to check status: `pnpm migrate:verify`
- ✅ Validation ties errors to specific migrations
- ✅ Hard to miss migration warnings on startup

## Testing

### Test Startup Validation

1. **Simulate missing migration:**
   ```sql
   -- Connect to database
   DELETE FROM schema_migrations 
   WHERE filename = '0002_update_time_control_values.sql';
   
   -- Manually revert constraint
   ALTER TABLE rooms DROP CONSTRAINT rooms_time_control_valid;
   ALTER TABLE rooms ADD CONSTRAINT rooms_time_control_valid 
   CHECK (time_control IN ('rapid', 'blitz', 'extended'));
   ```

2. **Start API server:**
   ```bash
   pnpm dev:api
   ```

3. **Observe:**
   - Should see loud warning with constraint mismatch
   - Should tell you to run `pnpm migrate`
   - Server should still start

4. **Fix:**
   ```bash
   pnpm migrate
   ```

5. **Restart API server:**
   - Should now show "✅ All schema validation checks passed!"

### Test Verification Command

```bash
# Check status
pnpm migrate:verify

# Should show detailed output with applied/pending migrations
# Should check rooms.time_control constraint
```

### Test Room Creation

1. Start all services
2. Navigate to `/rooms/create`
3. Fill form, click "Create Room"
4. Should succeed with room code
5. Should NOT see constraint violation

## Next Steps

1. ✅ Run `pnpm migrate` immediately to fix current database
2. ✅ Test room creation works
3. ✅ Add to team workflow: always run `pnpm migrate` after `git pull`
4. ✅ Watch startup logs for validation warnings

## Summary

This fix prevents the "pending migration" problem class by:

1. **Detecting** schema mismatches at server startup (can't miss the warnings)
2. **Diagnosing** with `pnpm migrate:verify` command (see exactly what's wrong)
3. **Documenting** troubleshooting steps (MIGRATION_TROUBLESHOOTING.md)
4. **Preventing** via clear workflow guidance (QUICK_START.md)

The room creation failure will now be caught immediately at startup with clear instructions on how to fix it, instead of being discovered as a cryptic runtime error.
