# Windows Development Setup Guide

## Judge0 Mock Server for Windows

Real Judge0 requires Linux cgroups for sandboxing and **cannot run natively on Windows**. This project includes a mock Judge0 server that simulates code execution for local development.

## Quick Setup

### 1. Configure Judge Worker

The `.env` file has been created in `services/judge-worker/.env` with:

```env
JUDGE0_URL=http://localhost:2359
```

This points to the mock Judge0 server instead of the real one (port 2358).

### 2. Start Mock Judge0 Server

In a terminal:

```bash
pnpm dev:judge0-mock
```

You should see:
```
🎭 Mock Judge0 Server listening on port 2359
⚠️  WARNING: This is a DEVELOPMENT MOCK - use real Judge0 on Linux for production!
```

### 3. Verify Mock Server

Test the mock server is working:

```bash
curl http://localhost:2359/about
```

Expected response:
```json
{
  "version": "1.13.1-mock",
  "homepage": "https://judge0.com",
  "source_code": "https://github.com/judge0/judge0",
  "maintainer": "Mock Judge0 for Windows Development"
}
```

### 4. Start All Services

Open **4 separate terminals** and run:

**Terminal 1 - Mock Judge0:**
```bash
pnpm dev:judge0-mock
```

**Terminal 2 - API Server:**
```bash
pnpm dev:api
```

**Terminal 3 - Match Server:**
```bash
pnpm dev:match
```

**Terminal 4 - Judge Worker:**
```bash
pnpm dev:judge
```

### 5. Verify Judge Worker Connection

When the judge-worker starts, you should see:

```
[Judge Worker] Starting...
Redis URL: redis://localhost:6379
Queue Name: judge_submissions
Concurrency: 2
Judge0 URL: http://localhost:2359

[Judge Worker] Checking Judge0 health...
✅ Judge0 is reachable
```

**If you see** `⚠️ WARNING: Judge0 is NOT reachable`, the mock server isn't running or the `.env` file has the wrong URL.

## Testing Code Execution

### Submit a Test Problem

1. Navigate to `/practice` in the frontend
2. Select any problem
3. Write a simple solution (e.g., for "Sum of Array"):

```typescript
function solve(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
```

4. Click "Submit"

### Expected Judge Worker Logs

You should see detailed execution logs:

```
[Judge Worker] Processing submission: <uuid>
[Judge Worker] Language: typescript -> Judge0 ID: 74
[Judge Worker] Judging submission ... for problem sum-of-array (4 tests)

[Judge Worker] Test 1/4:
  - Input length: X chars
  - Expected output length: Y chars
[Judge Worker] Test 1 submitted with token: <token>
[Judge Worker] Poll #1 for token <token>:
  - Status ID: 3
  - Status description: Accepted
[Judge Worker] Test 1 execution complete:
  - Stdout length: Z chars
  - Time: 0.123
  - Memory: 3000 KB
[Judge Worker] Test 1 output comparison:
  - Passed: true
  - Details: Match

Test 1: PASS - Match (accepted)
```

## Mock Server Limitations

The mock server:
- ✅ Simulates Python and JavaScript execution
- ✅ Returns realistic time/memory metrics
- ✅ Detects runtime errors and timeouts
- ⚠️ Does NOT actually compile C/C++/Java (returns success without execution)
- ⚠️ Has limited sandboxing (uses Node.js child_process)
- ❌ Should NOT be used in production

## Production Deployment

For production on Linux:

1. Use real Judge0: `pnpm judge0:up`
2. Update judge-worker `.env` to `JUDGE0_URL=http://localhost:2358`
3. Ensure Docker and Judge0 container are running

## Troubleshooting

### "Judge0 is NOT reachable"

**Check:**
1. Is mock server running? (`pnpm dev:judge0-mock`)
2. Is it on the right port? (should be 2359)
3. Does `.env` have `JUDGE0_URL=http://localhost:2359`?

**Test manually:**
```bash
curl http://localhost:2359/about
```

### Port 2359 Already in Use

**Find the process:**
```bash
netstat -ano | findstr :2359
```

**Kill it:**
```bash
taskkill /PID <PID> /F
```

### All Tests Return "internal_error"

This was the original issue! Causes:
1. Judge worker not connected to Judge0/mock
2. Wrong language IDs
3. Invalid Judge0 request format

**Verify judge-worker logs show:**
- ✅ "Judge0 is reachable"
- Language mapping (e.g., "typescript -> Judge0 ID: 74")
- Actual test execution with stdout/stderr

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `pnpm dev:judge0-mock` | Start mock Judge0 server (port 2359) |
| `pnpm dev:api` | Start API server (port 3001) |
| `pnpm dev:match` | Start match server (port 4100) |
| `pnpm dev:judge` | Start judge worker |
| `pnpm judge0:up` | Start real Judge0 via Docker (Linux only) |
| `pnpm judge0:down` | Stop real Judge0 |

## Why Mock Instead of Real Judge0?

Real Judge0 uses **Linux cgroups** for security isolation:
- Prevents infinite loops from crashing the host
- Enforces CPU/memory limits
- Isolates file system access

Windows does not have cgroups. While Judge0's Docker image technically runs on Docker Desktop for Windows, it runs in a Linux VM and has compatibility issues with the networking and resource management that ClashOfCode requires.

The mock server trades security for development convenience - it's fine for local testing but must never face untrusted code in production.

## Using Real Judge0 on WSL2/Ubuntu

If you want to use real Judge0 on WSL2 or Linux, you may encounter the **cgroup v2 compatibility issue** where Judge0 gives "Internal Error" (status 13) even though the containers are running.

**Common symptoms:**
- Judge0 health check passes
- Submissions return "Internal Error"
- `docker logs workers-1` shows isolate sandbox errors like "cannot mount cgroup", "cg_enable failed", etc.

**Quick fix attempt:**

1. Check your cgroup version inside WSL Ubuntu:
   ```bash
   stat -fc %T /sys/fs/cgroup/
   ```
   - `cgroup2fs` = problem (pure v2)
   - `tmpfs` = should work (hybrid)

2. If pure v2, force hybrid mode by creating `%UserProfile%\.wslconfig` on Windows:
   ```ini
   [wsl2]
   kernelCommandLine = cgroup_no_v1=all cgroup_enable=memory swapaccount=1 systemd.unified_cgroup_hierarchy=0
   ```

3. Restart WSL:
   ```powershell
   wsl --shutdown
   ```

4. Restart Docker Desktop and verify:
   ```bash
   stat -fc %T /sys/fs/cgroup/
   ```

**For complete troubleshooting steps, see [JUDGE0_TROUBLESHOOTING.md](./JUDGE0_TROUBLESHOOTING.md)**

**Recommended approach for local development:** Use the mock Judge0 server and reserve real Judge0 for actual Linux deployment (VPS, CI runner) where cgroup compatibility is more consistent.
