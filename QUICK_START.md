# Quick Start Guide - ClashOfCode Development

## First Time Setup (5 minutes)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env
# PowerShell: Copy-Item .env.example .env

# 3. Start database containers
pnpm docker:up

# 4. Apply migrations
pnpm migrate

# 5. Seed test data
pnpm seed
```

## Daily Development (Windows)

Open **4-5 terminals** and run:

```bash
# Terminal 1 - Mock Judge0 (for Windows/WSL2)
pnpm dev:judge0-mock

# Terminal 2 - API Server
pnpm dev:api

# Terminal 3 - Match Server
pnpm dev:match

# Terminal 4 - Judge Worker
pnpm dev:judge

# Terminal 5 - Frontend (if working on UI)
cd clashofcode-frontend
pnpm dev
```

**Note:** Use mock Judge0 for local dev. Real Judge0 requires Linux cgroups.

## Daily Development (Linux Production)

```bash
# Terminal 1 - Real Judge0
pnpm judge0:up

# Terminal 2-5 - Same as above (but judge worker uses port 2358)
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm migrate` | Apply new database migrations |
| `pnpm migrate:verify` | Check migration status and constraints |
| `pnpm seed` | Reset database with test data |
| `pnpm docker:up` | Start Postgres + Redis |
| `pnpm docker:down` | Stop Postgres + Redis |
| `pnpm judge0:up` | Start real Judge0 (Linux only) |
| `pnpm judge0:down` | Stop real Judge0 |
| `pnpm dev:judge0-mock` | Start mock Judge0 (port 2359) |

## After Pulling New Code

```bash
# 1. Update dependencies
pnpm install

# 2. Apply any new migrations
pnpm migrate

# 3. Verify migrations applied correctly
pnpm migrate:verify

# 4. Rebuild shared package (usually automatic)
pnpm build:shared

# 5. Restart your services
```

**Note:** The API server now validates schema on startup and will show loud warnings if migrations are pending.

## Quick Health Checks

```bash
# Check Judge0 mock
curl http://localhost:2359/about

# Check Judge0 real (Linux)
curl http://localhost:2358/about

# Check API server
curl http://localhost:3001/health

# Check databases
docker ps  # Should see clash-postgres, clash-redis
```

## Troubleshooting Quick Fixes

### "Migration failed" or "Column doesn't exist"
```bash
pnpm migrate
pnpm migrate:verify  # Confirm migrations applied
```

### "Room creation fails with constraint violation"
```bash
# Check migration status
pnpm migrate:verify

# Apply pending migrations
pnpm migrate

# Restart API server
```

See [MIGRATION_TROUBLESHOOTING.md](./MIGRATION_TROUBLESHOOTING.md) for details.

### "Port already in use"
```powershell
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### "Judge0 Internal Error"
```bash
# Use mock Judge0 instead
pnpm dev:judge0-mock
```

### Stray Docker containers
```powershell
.\scripts\cleanup-docker.ps1
```

## Key Ports

| Service | Port |
|---------|------|
| Frontend | 5173 |
| API Server | 3001 |
| Match Server | 4100 |
| Judge0 Mock | 2359 |
| Judge0 Real | 2358 |
| Postgres | 5440 |
| Redis | 6379 |

## Test Accounts (after seed)

| Username | Password | Role |
|----------|----------|------|
| alice | password | User |
| bob | password | User |
| charlie | password | User |

## Need More Help?

- **Windows Setup**: [WINDOWS_DEV_SETUP.md](./WINDOWS_DEV_SETUP.md)
- **Judge0 Issues**: [JUDGE0_TROUBLESHOOTING.md](./JUDGE0_TROUBLESHOOTING.md)
- **Full README**: [README.md](./README.md)

## Common Development Workflows

### Adding a New Feature
1. Pull latest code: `git pull`
2. Check for new migrations: `pnpm migrate`
3. Create feature branch: `git checkout -b feature/my-feature`
4. Start services (see Daily Development above)
5. Make changes, test locally
6. Commit and push

### Testing a Submission
1. Navigate to `/practice` in browser
2. Select any problem
3. Write solution in editor
4. Click "Run" to test sample cases
5. Click "Submit" to test full suite
6. Check judge-worker terminal for logs

### Testing Battle Mode
1. Open browser in two tabs
2. Login as different users (alice/bob)
3. Both join matchmaking or same room
4. Battle starts automatically
5. Submit solutions
6. Check match-server logs for events

### Debugging Judge0
```bash
# Check worker logs
docker logs -f workers-1

# Check judge-worker logs
# (in terminal where pnpm dev:judge is running)

# Test Judge0 directly
curl -X POST http://localhost:2359/submissions \
  -H "Content-Type: application/json" \
  -d '{"source_code": "print(42)", "language_id": 71}'
```

---

**Pro Tip:** Keep this file open in a terminal/editor while developing. It's faster than searching through full documentation.
