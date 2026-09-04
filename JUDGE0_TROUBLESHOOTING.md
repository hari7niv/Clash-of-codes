# Judge0 Internal Error Troubleshooting Guide

## The Problem

Judge0 gives "Internal Error" (status 13) even with real Docker Judge0 running. This is the **isolate-sandbox-vs-cgroups** problem — a known, common issue running Judge0 1.13.1's isolate sandbox under Docker Desktop / WSL2.

**Root Cause:** Judge0's isolate sandbox needs a specific cgroup layout (typically cgroup v1 or hybrid) that modern WSL2 kernels (which default to cgroup v2) don't provide out of the box, even inside Ubuntu. The `privileged: true` flag in docker-compose is often not enough.

**Note:** The judge-worker's health check passing only means Judge0's HTTP API is reachable — it says nothing about whether the workers container can actually sandbox-execute code.

---

## Step 1: Get the REAL Underlying Error (DO THIS FIRST)

The judge-worker only sees "Internal Error" / status 13 — it has no idea why. The actual reason lives in the Judge0 "workers" container's own logs.

### 1.1 Clean Up Stray Containers

First, ensure you don't have duplicate/conflicting containers:

```powershell
# Check what's running
docker ps

# Stop and remove any stray containers NOT part of your main stacks
# (Don't touch: server-1, workers-1, judge0-db-1, judge0-redis-1, clash-postgres, clash-redis)
docker stop worker-1 db-1 redis-1
docker rm worker-1 db-1 redis-1

# Check for leftover compose projects
docker compose ls

# If there's a third project causing conflicts, clean it up:
# docker compose -p <that-project-name> down -v
```

### 1.2 Restart Judge0 Stack Cleanly

```powershell
# From the workspace root
docker compose -f infra/judge0/docker-compose.judge0.yml down
docker compose -f infra/judge0/docker-compose.judge0.yml up -d

# Verify only the correct containers are running
docker ps
# Should see: server-1, workers-1, judge0-db-1, judge0-redis-1
```

### 1.3 Check Workers Logs

```powershell
# Watch the workers container logs in real-time
docker logs -f workers-1

# In another terminal, submit a test from your app
# Look for isolate-specific errors in the workers-1 logs
```

**Common errors to look for:**
- `cannot mount cgroup`
- `Sandbox already exists`
- `cg_enable failed`
- `Failed to open box`
- Permission/access errors
- `Cannot create cgroup`

**Paste the exact error message here for diagnosis before proceeding.**

---

## Step 2: Fix cgroup v1 vs v2 Mismatch (Most Common Cause)

This issue is extremely common on WSL2, Docker Desktop, and modern Ubuntu with cgroup v2 as default.

### 2.1 Check Your Current cgroup Version

**Inside WSL Ubuntu:**

```bash
stat -fc %T /sys/fs/cgroup/
```

**Results:**
- `cgroup2fs` = pure cgroup v2 (the likely problem)
- `tmpfs` = hybrid/v1-available (should work)

### 2.2 Force WSL2 into cgroup v1/Hybrid Mode

If you have pure cgroup v2, Judge0 1.13.1's isolate build expects v1 (or hybrid) cgroups.

**On Windows side:**

1. Open/create `%UserProfile%\.wslconfig` (e.g., `C:\Users\YourName\.wslconfig`)

2. Add this configuration:

```ini
[wsl2]
kernelCommandLine = cgroup_no_v1=all cgroup_enable=memory swapaccount=1 systemd.unified_cgroup_hierarchy=0
```

3. Shutdown WSL completely:

```powershell
wsl --shutdown
```

4. Restart Docker Desktop and WSL Ubuntu

5. Verify the change:

```bash
stat -fc %T /sys/fs/cgroup/
# Should now show hybrid/v1-compatible mount
```

### 2.3 Alternative: Use Newer Judge0 Images

Some Judge0 1.13.x patch releases specifically address cgroup v2 hosts. Check the [Judge0 GitHub repo](https://github.com/judge0/judge0) issues for:
- "cgroup v2"
- "isolate internal error"
- Latest recommended image tags

Consider updating the image tags in `infra/judge0/docker-compose.judge0.yml` if a newer version has better cgroup v2 support.

---

## Step 3: Pragmatic Fallback for Local Development

**Don't burn more time chasing kernel/cgroup config for local dev.**

### Use the Mock Judge0 Server

This repo includes `infra/judge0/mock-judge0-server.js` (port 2359) specifically for this reason.

**To switch to mock Judge0:**

1. Update your `.env` file:

```env
# Change from real Judge0
# JUDGE0_URL=http://localhost:2358

# To mock Judge0
JUDGE0_URL=http://localhost:2359
```

2. Start the mock server:

```powershell
# From workspace root
node infra/judge0/mock-judge0-server.js
```

Or add it to your `docker-compose.yml` as a service.

**Benefits:**
- No sandbox/cgroup issues
- Consistent behavior for development
- Faster iteration
- Works on any platform

**When to use real Judge0:**
- Actual Linux deployment target (VPS, proper Linux CI runner)
- Final integration testing before production
- When you need exact runtime behavior

---

## Step 4: Document the Decision

Update your project README to clearly state:

- **Local Development:** Use mock Judge0 server (port 2359)
- **Production/CI:** Use real Judge0 with proper Linux cgroup support
- **Known Issue:** Real Judge0 on WSL2/Docker Desktop has cgroup compatibility issues

This prevents re-investigating this same issue every development session.

---

## Quick Decision Tree

```
Can you get real isolate error from `docker logs workers-1`?
├─ YES → Paste error, google "judge0 isolate [that specific error]"
│        Look for cgroup, permission, or kernel issues
│
├─ NO / Still stuck after 15 min → Switch to mock Judge0 server
│                                  Document why and move on
│
└─ Production deployment? → Use real Linux VPS/VM, not WSL2
                           cgroup v1 or v2 should work fine there
```

---

## Verification

After applying fixes:

1. **Real Judge0:** Submit test code that should pass/fail
   - Check `docker logs -f workers-1` shows actual execution, not "cannot create sandbox"
   - Frontend should show real pass/fail per test, not uniform "Internal Error"

2. **Mock Judge0:** Submit test code
   - Should get deterministic pass/fail based on mock's simple logic
   - No Internal Error status 13

---

## Additional Resources

- [Judge0 GitHub Issues - cgroup v2](https://github.com/judge0/judge0/issues?q=cgroup)
- [WSL2 cgroup Configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [Docker Desktop WSL2 Backend](https://docs.docker.com/desktop/wsl/)
- Mock Judge0 server: `infra/judge0/mock-judge0-server.js`

---

## Summary

**The Real Fix:** Get cgroup v1/hybrid working in WSL2 (Steps 1-2)

**The Pragmatic Fix:** Use mock Judge0 for local dev (Step 3)

**For Production:** Deploy to real Linux with proper cgroup support

Choose based on how much time you want to spend on local environment setup vs. getting features done.
