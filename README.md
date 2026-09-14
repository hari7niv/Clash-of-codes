<div align="center">
  <h1>⚔️ ClashOfCode</h1>
  <p><strong>A competitive 1v1 Data Structures & Algorithms battle platform.</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify" />
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
    <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  </p>
</div>

<br/>

## 🏗️ Backend Architecture

Three independently deployable services sharing one types/schema package, because
they scale, fail, and deploy differently (Architecture §3.4 and §8):

| Service              | Kind                         | Tech                              |
| -------------------- | ---------------------------- | --------------------------------- |
| `services/api`       | Stateless REST               | Node.js + Fastify + Postgres      |
| `services/match-server` | Stateful (1 conn per battle) | Socket.io + Redis                 |
| `services/judge-worker` | Isolated code runner         | BullMQ consumer -> Judge0         |
| `packages/shared`    | Types + Zod + Glicko-2       | Imported by all three             |

## Prerequisites

- Node.js >= 20 (tested on 22)
- pnpm >= 9 (`corepack enable pnpm`)
- Docker (for Postgres, Redis, and Judge0)

## Quick start

```bash
pnpm install
cp .env.example .env            # (PowerShell: Copy-Item .env.example .env)

pnpm docker:up                  # Postgres + Redis
pnpm migrate                    # apply infra/migrations/*.sql
pnpm seed                       # seed problems + dev users

# For Linux: use real Judge0
pnpm judge0:up                  # start the isolated Judge0 stack

# For Windows: use mock Judge0 (real Judge0 needs Linux cgroups)
pnpm dev:judge0-mock            # mock Judge0 on port 2359

# each service in its own terminal
pnpm dev:api                    # API Server on port 4000
pnpm dev:judge                  # connects to Judge0/mock (port 2358/2359)
pnpm dev:match                  # Match Server on port 4100
```

> [!WARNING]
> **Windows Development Note**: Real Judge0 requires Linux cgroups and cannot run natively on Docker Desktop for Windows. 
> The project includes a mock Judge0 server (`infra/judge0/mock-judge0-server.js`) that runs on port 2359. 
> Ensure your `.env` file points to `JUDGE0_URL=http://localhost:2359` for local Windows development.
> Also ensure your frontend runs on port `3000` (e.g. `CORS_ORIGIN=http://localhost:3000`).

**WSL2/Linux Judge0 Note**: If using real Judge0 on WSL2 or Linux and getting "Internal Error" (status 13), this is usually a cgroup v1 vs v2 compatibility issue. See [JUDGE0_TROUBLESHOOTING.md](./JUDGE0_TROUBLESHOOTING.md) for detailed diagnosis and fixes. TL;DR: Use mock Judge0 for local dev, real Judge0 for production Linux deployment.

`pnpm build:shared` runs automatically before each `dev:*` script because the other
services import the compiled `@clashofcode/shared` package.

## Database Migrations

**IMPORTANT**: After pulling new changes, always check if new migration files exist in `infra/migrations/` and run:

```bash
pnpm migrate
```

This applies any pending migrations to your local database. Missing migrations cause cryptic runtime errors:
- Room creation fails with "missing value" or constraint violations (needs migration 0002)
- Settings page fails to save preferences (needs migration 0003)

**Current Migrations:**
1. `0001_init.sql` - Initial schema
2. `0002_auth_tokens_profiles.sql` - Auth tokens
3. `0002_update_time_control_values.sql` - Fix room time_control constraint (blitz/standard/deep)
4. `0003_add_user_preferences.sql` - Add user preferences columns for settings
5. `0003_room_fields_and_membership.sql` - Room fields and membership
6. `0004_progress_quests_social.sql` - Progress tracking
7. `0005_indexes_constraints.sql` - Performance indexes

**Verify migrations applied:**
```sql
SELECT filename, applied_at FROM schema_migrations ORDER BY filename;
```

The migration script (`infra/scripts/migrate.ts`) automatically detects and applies new `.sql` files in alphabetical order. Each migration runs in a transaction and is recorded in `schema_migrations` table to prevent duplicate applications.

## Layout

```
packages/shared      types first, so api & match-server never drift on the WS contract
services/api         auth, problems, leaderboard, rooms, practice-mode judging
services/judge-worker Judge0 in isolation — the only thing that runs untrusted code
services/match-server matchmaking + rooms + live battle lifecycle
infra                migrations (schema source of truth), seed scripts, Judge0 compose
```

## Build order (mirrors the SRS phased roadmap P2 -> P3)

1. `packages/shared` — the WS/type contract
2. `services/api` — REST + practice judging
3. `services/judge-worker` — prove the Judge0 pipeline standalone
4. `services/match-server` — wire matchmaking + rooms on top of the proven pipeline
5. `infra` — CI, seeds, compose

## The one boundary that matters

The judge never talks to the client. It talks only to Postgres and hands a verdict back
to `match-server`, which is the single source of truth for what each player sees
(Architecture §2.1).

## Troubleshooting

### Judge0 Issues

**Problem:** Submissions return "Internal Error" (status 13)

**Common Causes:**
1. Judge0 not running or not reachable
2. cgroup v1 vs v2 compatibility (WSL2/Linux)
3. Stray Docker containers from old compose projects

**Quick Checks:**
```bash
# Check Judge0 health
curl http://localhost:2358/about  # real Judge0
curl http://localhost:2359/about  # mock Judge0

# Check worker logs
docker logs -f workers-1

# Clean up stray containers (PowerShell)
.\scripts\cleanup-docker.ps1
```

**See [JUDGE0_TROUBLESHOOTING.md](./JUDGE0_TROUBLESHOOTING.md) for complete diagnosis and fixes.**

### Database Migration Issues

**Problem:** Runtime errors about missing columns/constraints

**Solution:** Run migrations after pulling new code:
```bash
pnpm migrate
```

### Port Already in Use

**Find and kill the process:**

Windows (PowerShell):
```powershell
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

Linux/WSL:
```bash
lsof -ti:3001 | xargs kill -9
```

### More Help

- **Windows Setup**: [WINDOWS_DEV_SETUP.md](./WINDOWS_DEV_SETUP.md)
- **Judge0 Troubleshooting**: [JUDGE0_TROUBLESHOOTING.md](./JUDGE0_TROUBLESHOOTING.md)
- **Battle Page Fixes**: [BATTLE_FIXES_COMPLETE.md](./BATTLE_FIXES_COMPLETE.md)
