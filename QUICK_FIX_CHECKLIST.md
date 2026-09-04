# Quick Fix Checklist

## Before You Start Developing

Run these commands in order every time you pull changes or start fresh:

```bash
# 1. Ensure Docker Desktop is running

# 2. Start PostgreSQL and Redis
pnpm docker:up

# 3. Check if migrations are needed
pnpm migrate:check

# 4. Apply any pending migrations
pnpm migrate

# 5. (Optional) Seed database with test data
pnpm seed
```

## Start Development Services

Open **4 separate terminals**:

```bash
# Terminal 1 - Mock Judge0 (Windows only)
pnpm dev:judge0-mock

# Terminal 2 - API Server (port 3001)
pnpm dev:api

# Terminal 3 - Match Server (port 4100)
pnpm dev:match

# Terminal 4 - Judge Worker
pnpm dev:judge
```

## Verification Checklist

### ✅ Room Creation Works
1. Navigate to `/rooms/create`
2. Select "Standard" battle tempo
3. Click "Create room"
4. Should see: "Your room is live" with room code
5. ❌ **If fails**: Run `pnpm migrate` (needs migration 0002)

### ✅ Settings Persist
1. Navigate to `/settings`
2. Toggle any preference
3. Click "Save changes"
4. Refresh page
5. Changes should remain
6. ❌ **If fails**: Run `pnpm migrate` (needs migration 0003)

### ✅ Practice Submissions Work
1. Navigate to `/practice`
2. Select a problem
3. Submit code
4. Should see test results (not all "internal_error")
5. ❌ **If fails**: Check judge-worker logs for Judge0 connection

### ✅ Judge Worker Connected
Check judge-worker terminal output:
```
✅ Judge0 is reachable
```

❌ **If shows warning**: Check `services/judge-worker/.env` has `JUDGE0_URL=http://localhost:2359`

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Room creation fails "missing value" | Old time_control constraint | `pnpm migrate` |
| Settings won't save | Missing user columns | `pnpm migrate` |
| Judge0 not reachable | Mock server not running | `pnpm dev:judge0-mock` |
| All tests "internal_error" | Wrong Judge0 URL | Check `.env` has port 2359 |
| ECONNREFUSED on migrate | PostgreSQL not running | `pnpm docker:up` |

## Quick Commands Reference

```bash
# Database
pnpm docker:up           # Start PostgreSQL + Redis
pnpm migrate             # Apply pending migrations
pnpm migrate:check       # Check migration status
pnpm seed                # Seed test data

# Services (each in separate terminal)
pnpm dev:judge0-mock     # Mock Judge0 (port 2359)
pnpm dev:api             # API server (port 3001)
pnpm dev:match           # Match server (port 4100)
pnpm dev:judge           # Judge worker

# Build & Test
pnpm build               # Build all services
pnpm typecheck           # Run TypeScript checks
```

## First Time Setup (Fresh Install)

```bash
# 1. Install dependencies
pnpm install

# 2. Create environment files
# Copy all .env.example to .env in:
# - Root directory
# - services/api/
# - services/judge-worker/
# - services/match-server/

# 3. Ensure judge-worker/.env has:
JUDGE0_URL=http://localhost:2359

# 4. Start Docker
pnpm docker:up

# 5. Run migrations
pnpm migrate

# 6. Seed database
pnpm seed

# 7. Start all services (4 terminals)
pnpm dev:judge0-mock
pnpm dev:api
pnpm dev:match
pnpm dev:judge
```

## After Pulling Changes

```bash
git pull
pnpm install            # Update dependencies if package.json changed
pnpm migrate:check      # Check for new migrations
pnpm migrate            # Apply if needed
pnpm build              # Rebuild if TypeScript changed
```

## Help & Documentation

- Full migration guide: `MIGRATION_GUIDE.md`
- Windows setup: `WINDOWS_DEV_SETUP.md`
- Main README: `README.md`

## Emergency Reset

If everything is broken:

```bash
# Stop all services (Ctrl+C in each terminal)

# Destroy and recreate database
pnpm docker:down
pnpm docker:up

# Fresh migration
pnpm migrate

# Reseed data
pnpm seed

# Restart services
```
