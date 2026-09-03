# RUNTIME COMPONENT MAP

## Infrastructure Components

| Component | Purpose | Start Command | Port | Dependencies | Status |
|-----------|---------|---------------|------|--------------|--------|
| PostgreSQL | Primary database | `pnpm docker:up` | 5440 | None | NOT VERIFIED |
| Redis | Queue/cache/sessions | `pnpm docker:up` | 6379 | None | NOT VERIFIED |
| Judge0 | Code execution | `pnpm judge0:up` | 2358 | None | NOT VERIFIED |

## Application Services

| Component | Purpose | Start Command | Port | Dependencies | Env Vars | Status |
|-----------|---------|---------------|------|--------------|----------|--------|
| **@clashofcode/shared** | Shared types | `pnpm build:shared` | N/A | None | None | NOT BUILT |
| **@clashofcode/infra** | Migrations/Seeds | `pnpm migrate && pnpm seed` | N/A | PostgreSQL, @clashofcode/shared | DATABASE_URL | NOT RUN |
| **@clashofcode/api** | REST API | `pnpm dev:api` | 4000 | PostgreSQL, Redis, BullMQ, @clashofcode/shared | DATABASE_URL, REDIS_URL, JWT_SECRET, API_PORT, CORS_ORIGIN, JUDGE_QUEUE_NAME | NOT STARTED |
| **@clashofcode/match-server** | WebSocket/Matchmaking | `pnpm dev:match` | 4100 | PostgreSQL, Redis, BullMQ, @clashofcode/shared | DATABASE_URL, REDIS_URL, JWT_SECRET, MATCH_PORT, JUDGE_QUEUE_NAME, PAIRING_* | NOT STARTED |
| **@clashofcode/judge-worker** | Judge0 consumer | `pnpm dev:judge` | N/A | PostgreSQL, Redis, BullMQ, Judge0, @clashofcode/shared | DATABASE_URL, REDIS_URL, JUDGE0_URL, JUDGE_QUEUE_NAME | NOT STARTED |
| **clashofcode-frontend** | React UI | `cd clashofcode-frontend && pnpm dev` | 5173 | API (4000), Match Server (4100) | (embedded in code) | NOT STARTED |

## Critical Dependencies Chain

```
PostgreSQL (5440)
    ↓
Redis (6379)
    ↓
Judge0 (2358)
    ↓
@clashofcode/shared (build)
    ↓
Database Migrations
    ↓
Database Seeding
    ↓
[Services can start in parallel]
    ├── @clashofcode/api (4000)
    ├── @clashofcode/match-server (4100)
    └── @clashofcode/judge-worker
    ↓
clashofcode-frontend (5173)
```

## Environment Variables

### Critical Variables (Must Match Across Services):
- `JWT_SECRET` - Used by API & Match Server for auth
- `JUDGE_QUEUE_NAME` - Used by API, Match Server (producers) & Judge Worker (consumer)
- `DATABASE_URL` - All services need DB access
- `REDIS_URL` - All services need Redis access

### Current Configuration:
- DATABASE_URL: `postgres://clash:clash@localhost:5440/clashofcode` ✓
- REDIS_URL: `redis://localhost:6379` ✓
- JWT_SECRET: `dev-super-secret-change-me-in-prod` ✓
- JUDGE_QUEUE_NAME: `judge` ✓
- JUDGE0_URL: `http://localhost:2358` ✓
- API_PORT: `4000` ✓
- MATCH_PORT: `4100` ✓
- CORS_ORIGIN: `http://localhost:5173` ✓

## Health Check Commands

```bash
# PostgreSQL
docker ps | findstr clash-postgres
docker exec clash-postgres pg_isready -U clash -d clashofcode

# Redis
docker ps | findstr clash-redis
docker exec clash-redis redis-cli ping

# Judge0
curl http://localhost:2358/about

# API
curl http://localhost:4000/health

# Match Server
curl http://localhost:4100/health
```

## Testing Ports in Use

```powershell
# Check if ports are available/in use
netstat -ano | findstr ":5440"
netstat -ano | findstr ":6379"
netstat -ano | findstr ":2358"
netstat -ano | findstr ":4000"
netstat -ano | findstr ":4100"
netstat -ano | findstr ":5173"
```

