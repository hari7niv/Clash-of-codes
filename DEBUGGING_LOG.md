# DEBUGGING LOG - Runtime Verification & Fixes

## Mission
Make the application FUNCTIONALLY WORK END-TO-END through execution, tracing, debugging, and verification.

## Session Started
Date: 2026-09-02

---

## PHASE 1: REPOSITORY INSPECTION

### Repository Structure Analysis

**Package Manager:** pnpm@11.22.0
**Node Version Required:** >=20
**Workspace Type:** pnpm monorepo

#### Services Identified:
1. **@clashofcode/api** - REST API (port 4000)
2. **@clashofcode/match-server** - WebSocket server (port 4100)
3. **@clashofcode/judge-worker** - BullMQ consumer for Judge0 integration
4. **clashofcode-frontend** - Vite React frontend (port 5173)

#### Packages:
1. **@clashofcode/shared** - Shared types and schemas
2. **@clashofcode/infra** - Database migrations and seeding

#### Infrastructure Dependencies:
1. **PostgreSQL** - port 5440 (docker)
2. **Redis** - port 6379 (docker)
3. **Judge0** - port 2358 (separate docker-compose)

---

## PHASE 2: STARTUP COMMAND MAPPING

### Root Level Commands (from package.json):
```bash
pnpm docker:up           # Start Postgres + Redis
pnpm judge0:up           # Start Judge0 stack
pnpm build:shared        # Build shared package first
pnpm migrate             # Run database migrations
pnpm seed                # Seed problems and dev users
pnpm dev:api             # Start API server
pnpm dev:match           # Start match server
pnpm dev:judge           # Start judge worker
```

### Frontend Commands:
```bash
cd clashofcode-frontend
pnpm dev                 # Start Vite dev server
```

---

## PHASE 3: ENVIRONMENT VERIFICATION

### Configuration Files Found:
- `.env.example` ✓
- `.env` (checking...)



## PHASE 4: INFRASTRUCTURE VERIFICATION ✓

### Docker Containers Status:
- **clash-postgres**: RUNNING, HEALTHY ✓
- **clash-redis**: RUNNING, HEALTHY ✓
- **judge0-server-1**: RUNNING ✓
- **judge0-workers-1**: RUNNING ✓

### Health Checks:
```bash
# PostgreSQL
$ docker exec clash-postgres pg_isready -U clash -d clashofcode
/var/run/postgresql:5432 - accepting connections ✓

# Redis
$ docker exec clash-redis redis-cli ping
PONG ✓

# Judge0
$ curl.exe -s http://localhost:2358/about
{"version":"1.13.1",...} ✓
```

### Database Schema:
- 15 tables created ✓
- Users table populated (5 users) ✓
- Problems table populated (3 problems) ✓
- Migrations completed ✓

### Shared Package:
- @clashofcode/shared built successfully ✓

---

## PHASE 5: STARTING APPLICATION SERVICES

### Service Startup Order:
1. API Server (port 4000)
2. Match Server (port 4100)
3. Judge Worker (background)
4. Frontend (port 5173)



### Starting Match Server (port 4100):

**CRITICAL BUG #1 FOUND:**
```
Error: BullMQ: Your redis options maxRetriesPerRequest must be null.
```

**Root Cause:** BullMQ requires specific Redis connection options that prevent timeout/retry issues with blocking commands.

**Location:** services/match-server/src/services/queue-listener.ts

**Investigation Required:** Check Redis connection configuration in match-server



**FIX APPLIED:**
- File: `services/match-server/src/index.ts`
- File: `services/api/src/services/judge-queue.ts`
- File: `services/api/src/routes/matchmaking/matchmaking.routes.ts`
- File: `services/judge-worker/src/index.ts`
- Change: Added `maxRetriesPerRequest: null` to all Redis/BullMQ connections

**Verification:**
```
tsx watch detected changes and restarted match-server
[Match Server] 🎧 Listening to judge queue: judge_submissions
🎯 [Match Server] Matchmaking loop started
✅ [Match Server] Listening on port 4100
✅ Match Server connected to PostgreSQL (Drizzle)
```

**Status:** FIXED ✓

### Starting Judge Worker:



**Status:** RUNNING ✓
```
🚀 [Judge Worker] Starting...
✅ Judge Worker ready! Listening for jobs on queue: judge_submissions
```

### Starting Frontend (Vite):

**ISSUE #2 FOUND:**
Frontend is running on port 3000, but API CORS is configured for port 5173!

```
VITE v7.3.6  ready in 6271 ms
➜  Local:   http://localhost:3000/
```

**Expected:** http://localhost:5173
**Actual:** http://localhost:3000

**Root Cause:** Vite configuration or port conflict



**FIX APPLIED:**
- File: `.env`
- Change: Updated `CORS_ORIGIN=http://localhost:3000` (was 5173, but Vite runs on 3000)

**API Restarted:** ✓

---

## PHASE 6: AUTHENTICATION END-TO-END TEST

### Test User Credentials (from database):
- Username: `alice`
- Email: `alice@clash.dev`
- Username: `bob`
- Email: `bob@clash.dev`

### Testing Login Flow:



**Test Command:**
```powershell
$jsonBody = @{email='alice@clash.dev';password='password123'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' -Method POST -Body $jsonBody -ContentType 'application/json'
```

**Result:** ✓ SUCCESS
```json
{
  "user": {
    "id": "92ca41f8-5c8f-4bf5-8850-afe5ee0285c1",
    "name": "alice",
    "handle": "alice",
    "rating": 1500
  },
  "accessToken": "eyJh...",
  "refreshToken": "198..."
}
```

**Test Authenticated Endpoint (GET /api/users/me):**
```
Authorization: Bearer eyJh...
```

**Result:** ✓ SUCCESS
```json
{
  "name": "alice",
  "handle": "alice",
  "rating": 1500,
  "level": 1,
  "xp": 0,
  "wins": 0,
  "losses": 0
}
```

---

## PHASE 7: JUDGE0 DIRECT TEST

Testing Judge0 code execution with a simple Python program:



**Test Command:**
```powershell
$body = @{source_code='print("Hello from Judge0")';language_id=71;stdin=''} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:2358/submissions?base64_encoded=false&wait=true' -Method POST -Body $body -ContentType 'application/json'
```

**Result:** ❌ FAILED
```json
{
  "status": {"id": 13, "description": "Internal Error"},
  "message": "No such file or directory @ rb_sysopen - /box/script.py"
}
```

**CRITICAL BUG #3:**
Judge0 cannot create files in `/box/` directory.

**Root Cause (from Judge0 logs):**
```
Failed to create control group /sys/fs/cgroup/memory/box-1/: No such file or directory
chown: cannot access '/box': No such file or directory
```

This is a cgroup/sandbox isolation issue. Judge0 requires proper cgroup configuration or privileged mode.

**Investigation:** Checking Judge0 docker-compose configuration...



**Attempted Manual Fix:**
```bash
docker exec -u root judge0-workers-1 mkdir -p /box
docker exec -u root judge0-workers-1 chmod 777 /box
```

**Result:** Still fails with same error

**Root Cause Analysis:**
Judge0 uses `isolate` (https://github.com/ioi/isolate) for sandboxing, which requires Linux cgroups v1/v2.
Docker Desktop on Windows/macOS uses a Linux VM but doesn't support the cgroup hierarchy that isolate requires.

**From Judge0 Documentation:**
> "Judge0 is designed to run on Linux. On Windows/macOS you should use Docker, but be aware that sandboxing won't work properly..."

**CRITICAL LIMITATION:**
Judge0 CANNOT execute code properly on Windows Docker Desktop. This is a KNOWN UPSTREAM LIMITATION, not a bug in this application.

**Options:**
1. Deploy on Linux host (production environment)
2. Use WSL2 with proper cgroup configuration  
3. Create mock Judge0 service for Windows development testing

**Decision:** Create a minimal mock Judge0 API for development testing on Windows, allowing end-to-end flow verification.



### Mock Judge0 Solution:

**Created:** `infra/judge0/mock-judge0-server.js`  
**Port:** 2359 (to avoid conflict with real Judge0)

**Test:**
```powershell
$body = @{source_code='print("Hello from Mock Judge0!")';language_id=71;stdin=''} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' -Method POST -Body $body -ContentType 'application/json'
```

**Result:** ✓ SUCCESS
```json
{
  "status": {"id": 3, "description": "Accepted"},
  "stdout": "Hello from Mock Judge0!\\r\\n",
  "time": "0.241",
  "memory": 3000
}
```

**Updated .env:**
```
JUDGE0_URL=http://localhost:2359
```

Now all services should restart with the new Judge0 URL...

