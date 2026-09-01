# Judge Worker Service

The judge-worker is a horizontally-scalable BullMQ consumer that processes asynchronous code submission judging jobs.

## Architecture

- **Queue**: BullMQ (Redis-backed)
- **Job Type**: `judge_submissions`
- **Concurrency**: Configurable (default: 2)
- **Retry Strategy**: 1 retry on transient failures (NFR-4.6)
- **Judge0 Integration**: Sandboxed code execution with zero network access (NFR-3.4)

## Features

✅ Async job processing from Redis queue
✅ Polling-based Judge0 integration with exponential backoff (p95 <3s per NFR-1.2)
✅ Per-test-case judging with output comparison
✅ Float tolerance support (relative error comparison)
✅ Automatic verdict mapping (6 verdict types)
✅ Graceful shutdown on SIGTERM/SIGINT
✅ Structured logging for debugging
✅ Retry-once-on-failure resilience

## Setup

```bash
# Install dependencies (from root)
pnpm install

# Copy environment file
cp .env.example .env

# Configure as needed
nano .env
```

## Running

### Development Mode

```bash
# Terminal 1: Start the worker
cd services/judge-worker
pnpm dev

# Terminal 2: Run test script to verify it works
cd services/judge-worker
npx tsx scripts/test-single-submission.ts
```

### Production Mode

```bash
# Build
pnpm build

# Start
pnpm start
```

## Configuration

See `.env.example` for all available environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `JUDGE_QUEUE_NAME` | `judge_submissions` | BullMQ queue name |
| `WORKER_CONCURRENCY` | `2` | Concurrent job processing (for horizontal scaling) |
| `JUDGE0_URL` | `http://localhost:2358` | Judge0 API endpoint |
| `JUDGE0_API_KEY` | (empty) | Judge0 API key (optional) |
| `DATABASE_URL` | `postgres://clash:clash@localhost:5440/clashofcode` | PostgreSQL connection |
| `FLOAT_TOLERANCE` | `1e-9` | Float comparison precision |

## Testing

### Standalone Test

Process a single submission end-to-end:

```bash
npx tsx scripts/test-single-submission.ts
```

This script:
1. ✓ Connects to database and Redis
2. ✓ Creates a test submission
3. ✓ Enqueues a judge job
4. ✓ Waits for processing (max 30s)
5. ✓ Verifies verdict and test results
6. ✓ Cleans up

## How It Works

1. **Job Enqueue** (by services/api):
   ```javascript
   await queue.add('judge', { submissionId: 'uuid' })
   ```

2. **Job Processing** (by judge-worker):
   - Fetch submission, problem, test cases from database
   - For each test case:
     - Submit code + input to Judge0
     - Poll for result with exponential backoff (200ms → 1s)
     - Compare output (string equality first, then float tolerance)
     - Determine test verdict
   - Update submission with final verdict and test counts

3. **Job Completion**:
   - Submission table: `verdict`, `passed_tests`, `total_tests`, `judged_at` updated
   - Result ready for match service to calculate rating changes

## Supported Languages

```
Python (75)
JavaScript/Node (44)
TypeScript (88)
C++ (23)
Java (21)
Rust (79)
```

(Judge0 language ID mapping in `src/judge0-client.ts`)

## Database Schema

### submissions table
- `id` (uuid, PK)
- `match_id` (uuid, FK) - nullable
- `user_id` (uuid, FK) - required
- `problem_id` (uuid, FK) - required
- `language` (varchar) - "python", "javascript", etc.
- `source_code` (text)
- `verdict` (enum) - "pending", "accepted", "wrong_answer", "time_limit_exceeded", "memory_limit_exceeded", "runtime_error", "compilation_error", "internal_error"
- `passed_tests` (int) - count of passed test cases
- `total_tests` (int) - total test case count
- `runtime_ms` (int) - not yet populated
- `memory_kb` (int) - not yet populated
- `created_at`, `judged_at` (timestamp)

### test_cases table
- `id` (uuid, PK)
- `problem_id` (uuid, FK)
- `input` (text)
- `expected_output` (text)
- `is_sample` (boolean)
- `ordinal` (int) - for ordering

## Scaling

To process more jobs concurrently:

```bash
# Increase worker concurrency (in same process)
WORKER_CONCURRENCY=10 pnpm start

# Or run multiple worker instances (each with WORKER_CONCURRENCY=2)
WORKER_CONCURRENCY=2 pnpm start &
WORKER_CONCURRENCY=2 pnpm start &
WORKER_CONCURRENCY=2 pnpm start &
# All instances will consume from the same Redis queue
```

## Monitoring

Worker logs include:
- Job start/completion timestamps
- Test case pass/fail status
- Verdict assignment
- Retry attempts
- Errors with stack traces

Example output:
```
🚀 [Judge Worker] Starting...
   Redis URL: redis://localhost:6379
   Queue Name: judge_submissions
   Concurrency: 2
✅ Judge Worker ready! Listening for jobs on queue: judge_submissions

[Judge Worker] Processing submission: a1b2c3d4-e5f6-...
[Judge Worker] Judging submission a1b2c3d4... for problem add (5 tests)
[Judge Worker] Test 1: PASS - Output matches
[Judge Worker] Test 2: PASS - Output matches
[Judge Worker] Test 3: FAIL - Expected 5, got 4
[Judge Worker] Test 4: PASS - Output matches
[Judge Worker] Test 5: PASS - Output matches
[Judge Worker] Submission a1b2c3d4... judged: wrong_answer (4/5 tests passed)
[Judge Worker] ✅ Job a1b2c3d4 completed
```

## Troubleshooting

### Worker not starting
- ✓ Check Redis is running: `docker ps | grep redis`
- ✓ Check DATABASE_URL is correct
- ✓ Check JUDGE0_URL is reachable

### Jobs not being processed
- ✓ Verify worker is running: check console output
- ✓ Check Redis queue: `redis-cli LLEN judge_submissions`
- ✓ Check worker logs for errors

### Timeout waiting for Judge0
- ✓ Verify Judge0 is running: `curl http://localhost:2358/languages`
- ✓ Check Judge0 logs: `docker logs clash-judge0`
- ✓ Verify network: `ping localhost`

### Output comparison failures
- ✓ Check test case expected_output formatting (trailing whitespace, newlines)
- ✓ For floating-point: adjust `FLOAT_TOLERANCE` if needed
- ✓ Review comparison details in submission results

## Related Services

- **services/api**: Enqueues judge jobs, returns hardcoded verdict in Phase 1 (to be wired in Phase 2)
- **services/match-server**: Consumes judge results to trigger match completion (Phase 3)
- **infra**: Database schema and migrations

## Next Steps

- Phase 1b: Verify judge-worker with standalone test
- Phase 2: Wire services/api to enqueue jobs + implement result polling
- Phase 2: Wire Glicko-2 rating calculation on match completion
- Phase 3: Build services/match-server with real-time WebSocket integration
