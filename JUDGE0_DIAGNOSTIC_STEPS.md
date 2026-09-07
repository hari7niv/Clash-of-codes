# Judge0 Diagnostic Steps

## Current Status
Judge0 workers are reporting cgroup and /box filesystem errors on Windows/WSL Docker Desktop:
- `Failed to create control group /sys/fs/cgroup/memory/box-N/`
- `No such file or directory @ rb_sysopen - /box/script.ts`

## Root Cause Analysis

### Issue 1: cgroup v1 vs cgroup v2
Judge0 1.13.1's `isolate` sandbox expects **cgroup v1** (legacy) but:
- **WSL 2** with systemd uses **cgroup v2** (unified hierarchy) by default
- Docker Desktop on Windows uses WSL 2 backend
- The `/sys/fs/cgroup/memory/` path doesn't exist in cgroup v2

### Issue 2: /box Mount Point
The `/box` directory is used by Judge0 workers for temporary code execution but may not be properly mounted or accessible within the container on Windows/WSL.

## Diagnostic Commands

### Step 1: Verify Docker is Running
```powershell
docker ps
```
Expected: Judge0 containers `judge0-server-1` and `judge0-workers-1` should be listed.

### Step 2: Check cgroup Type in WSL
```bash
# From WSL terminal
stat -fc %T /sys/fs/cgroup/
```
- If output is `cgroup2fs` → **cgroup v2** (incompatible with Judge0 1.13.1)
- If output is `tmpfs` → **cgroup v1** (compatible)

### Step 3: Check cgroup Mounts in Judge0 Worker Container
```bash
docker exec judge0-workers-1 sh -c 'mount | grep cgroup || true'
docker exec judge0-workers-1 sh -c 'ls -la /sys/fs/cgroup/'
docker exec judge0-workers-1 sh -c 'ls -la /sys/fs/cgroup/memory || echo "memory cgroup not found"'
```

### Step 4: Check /box Directory
```bash
docker exec judge0-workers-1 sh -c 'ls -la /box || echo "/box not found"'
docker exec judge0-workers-1 sh -c 'ls -la / | grep box'
```

### Step 5: Test Direct Judge0 Execution
```bash
curl -X POST \
  'http://localhost:2358/submissions?base64_encoded=false&wait=true' \
  -H 'Content-Type: application/json' \
  -d '{
    "language_id": 71,
    "source_code": "print(1+2)"
  }'
```

Expected: JSON response with `stdout: "3\n"` and `status.id: 3` (Accepted)
Actual (if broken): `status.id: 6` (Compilation Error) or `status.id: 11` (Internal Error)

## Solutions

### Solution A: Enable cgroup v1 in WSL (Requires Reboot)

1. Create or edit `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
kernelCommandLine = cgroup_no_v1=all systemd.unified_cgroup_hierarchy=0
```

2. Restart WSL:
```powershell
wsl --shutdown
wsl
```

3. Verify cgroup v1 is active:
```bash
stat -fc %T /sys/fs/cgroup/
# Should output: tmpfs (indicating cgroup v1)
```

4. Restart Judge0 containers:
```bash
cd infra/judge0
docker-compose -f docker-compose.judge0.yml down
docker-compose -f docker-compose.judge0.yml up -d
```

### Solution B: Upgrade to Judge0 1.13.2+ (with cgroup v2 Support)

Judge0 version 1.13.2 and later support cgroup v2. Update `docker-compose.judge0.yml`:

```yaml
services:
  server:
    image: judge0/judge0:1.13.2  # or latest
    # ... rest of config

  workers:
    image: judge0/judge0:1.13.2  # or latest
    # ... rest of config
```

Then rebuild:
```bash
cd infra/judge0
docker-compose -f docker-compose.judge0.yml down
docker-compose -f docker-compose.judge0.yml pull
docker-compose -f docker-compose.judge0.yml up -d
```

### Solution C: Disable Sandboxing (UNSAFE - Dev Only)

**⚠️ WARNING: This removes all security isolation. NEVER use in production.**

Add to Judge0 environment in `docker-compose.judge0.yml`:
```yaml
x-judge0-env: &judge0-env
  # ... existing vars
  ENABLE_SANDBOXING: "false"
  ENABLE_COMPILER_OPTIONS: "false"
```

This allows code to run without isolate sandboxing but **removes all security protections**.

## Verification Checklist

After applying any solution:

1. ✅ Judge0 containers start without errors
2. ✅ Direct curl test returns correct output
3. ✅ BullMQ job processes and returns verdict
4. ✅ Match-server receives verdict via Redis pub/sub
5. ✅ Frontend receives submission_result event

## Current Recommendation

**For Development on Windows/WSL:**
- Try **Solution A** first (cgroup v1) if you can reboot
- If Solution A doesn't work, try **Solution B** (Judge0 1.13.2+)
- Use **Solution C** only as last resort for quick testing

**For Production:**
- Deploy on Linux host with native cgroup support
- Use Judge0 1.13.2+ with cgroup v2
- Never disable sandboxing

## Additional Notes

- The `privileged: true` flag in docker-compose is necessary but not sufficient
- Docker Desktop's WSL 2 integration has limitations for kernel-level features like cgroups
- Some Judge0 features (network isolation, resource limits) may not work correctly on Windows/WSL even with fixes
