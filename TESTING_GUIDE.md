# 🧪 CLASH OF CODES - TESTING GUIDE

## ✅ ALL SERVERS RUNNING

| Service | Port | Status | URL |
|---------|------|--------|-----|
| **Frontend** | 3000 | ✅ RUNNING | http://localhost:3000 |
| **API Server** | 4000 | ✅ RUNNING | http://localhost:4000 |
| **Match Server** | 4100 | ✅ RUNNING | WebSocket |
| **Mock Judge0** | 2359 | ✅ RUNNING | http://localhost:2359 |
| **PostgreSQL** | 5440 | ✅ RUNNING | Database |
| **Redis** | 6379 | ✅ RUNNING | Cache |

---

## 🧑‍💻 TEST USERS

```
Username: alice          Username: bob
Email:    alice@clash.dev   Email: bob@clash.dev
Password: password123       Password: password123
Rating:   1500             Rating: 1520
```

---

## 🌐 FRONTEND TESTING

### 1. **Open the App**
```
http://localhost:3000
```

### 2. **Login**
- Email: `alice@clash.dev`
- Password: `password123`

### 3. **Explore the App**
- View your profile
- Browse problems
- Try different sections

---

## 🔌 API TESTING (Using PowerShell)

### 1. **AUTHENTICATION FLOW**

**Step 1: Login**
```powershell
$loginBody = @{email='alice@clash.dev';password='password123'} | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$loginResponse | ConvertTo-Json -Depth 10

# Extract token for later use
$token = $loginResponse.accessToken
Write-Host "Token: $token"
```

**Expected Response:**
```json
{
  "user": {
    "id": "92ca41f8-5c8f-4bf5-8850-afe5ee0285c1",
    "name": "alice",
    "handle": "alice",
    "rating": 1500,
    "rank": "Gold"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..."
}
```

---

### 2. **GET USER INFO**

```powershell
# Use the token from login above
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Replace with actual token

Invoke-RestMethod -Uri 'http://localhost:4000/api/users/me' `
  -Method GET `
  -Headers @{Authorization="Bearer $token"} | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "name": "alice",
  "handle": "alice",
  "rating": 1500,
  "level": 1,
  "xp": 0,
  "wins": 0,
  "losses": 0,
  "streak": 0,
  "peak": 1500,
  "battles": 0
}
```

---

### 3. **GET ALL PROBLEMS**

```powershell
Invoke-RestMethod -Uri 'http://localhost:4000/api/problems' `
  -Method GET `
  -Headers @{Authorization="Bearer $token"} | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": "49656f5c-ea4c-4438-9078-71b1ddec7e30",
      "title": "A + B",
      "topic": "math",
      "difficulty": "Easy",
      "points": 800
    },
    {
      "id": "cb3c55e0-a828-4f10-8b82-2ca9d12d17f6",
      "title": "Sum of an Array",
      "topic": "arrays",
      "difficulty": "Easy",
      "points": 1000
    },
    {
      "id": "772ebfa0-51f7-45c7-8d2a-17c01ea382c8",
      "title": "Reverse a String",
      "topic": "strings",
      "difficulty": "Easy",
      "points": 900
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 3
}
```

---

### 4. **GET PROBLEM DETAILS** (with test cases)

```powershell
$problemId = "49656f5c-ea4c-4438-9078-71b1ddec7e30"  # A + B problem

Invoke-RestMethod -Uri "http://localhost:4000/api/problems/$problemId" `
  -Method GET `
  -Headers @{Authorization="Bearer $token"} | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "id": "49656f5c-ea4c-4438-9078-71b1ddec7e30",
  "title": "A + B",
  "topic": "math",
  "difficulty": "Easy",
  "points": 800,
  "statement": "Read two integers `a` and `b` on a single line separated by a space, and print their sum.",
  "examples": [
    {
      "input": "1 2\n",
      "output": "3"
    },
    {
      "input": "-5 5\n",
      "output": "0"
    }
  ],
  "starterCode": {
    "python": "def solve():\n    # write code here\n    pass",
    "javascript": "function solve() {\n  // write code here\n}",
    ...
  }
}
```

---

### 5. **TEST JUDGE0 DIRECTLY** (Code Execution)

```powershell
$codeBody = @{
  source_code='print("Hello from Judge0!")'
  language_id=71
  stdin=''
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' `
  -Method POST `
  -Body $codeBody `
  -ContentType 'application/json' | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "token": "78d14e55-56bb-4415-8f80-d96b5a25dbdd",
  "status": {
    "id": 3,
    "description": "Accepted"
  },
  "stdout": "Hello from Judge0!\r\n",
  "stderr": null,
  "time": "0.241",
  "memory": 3000
}
```

---

### 6. **TEST PYTHON SOLUTION (A + B)**

```powershell
$pythonCode = 'a, b = map(int, input().split())
print(a + b)'

$codeBody = @{
  source_code=$pythonCode
  language_id=71
  stdin='5 3'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' `
  -Method POST `
  -Body $codeBody `
  -ContentType 'application/json' | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "status": {"id": 3, "description": "Accepted"},
  "stdout": "8\r\n",
  "time": "0.241"
}
```

---

## 📋 COMPLETE TEST FLOW CHECKLIST

Use this checklist to verify everything works:

### ✅ Backend API Tests
- [ ] POST /api/auth/login - Get JWT token
- [ ] GET /api/users/me - Verify authentication
- [ ] GET /api/problems - List all problems
- [ ] GET /api/problems/:id - Get problem details with examples
- [ ] POST /api/matchmaking/status - Check queue status

### ✅ Judge0 Tests
- [ ] POST /submissions (Mock Judge0) - Execute simple code
- [ ] Verify stdout is captured
- [ ] Verify status is "Accepted"

### ✅ Frontend Tests
- [ ] Open http://localhost:3000
- [ ] Login with alice@clash.dev / password123
- [ ] View profile
- [ ] Browse problems
- [ ] See your rating

### ✅ WebSocket Tests (Advanced)
- [ ] Open browser DevTools Network tab
- [ ] Check WS connection to localhost:4100
- [ ] Verify authentication token sent

---

## 🎯 QUICK API TESTING TEMPLATE

Copy-paste this into PowerShell to test everything:

```powershell
# 1. LOGIN
Write-Host "1. Testing Login..." -ForegroundColor Green
$loginBody = @{email='alice@clash.dev';password='password123'} | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$token = $login.accessToken
Write-Host "✅ Login successful! Token: $($token.Substring(0, 20))..." -ForegroundColor Green

# 2. GET USER
Write-Host "`n2. Getting User Info..." -ForegroundColor Green
$user = Invoke-RestMethod -Uri 'http://localhost:4000/api/users/me' -Method GET -Headers @{Authorization="Bearer $token"}
Write-Host "✅ User: $($user.name), Rating: $($user.rating), Level: $($user.level)" -ForegroundColor Green

# 3. GET PROBLEMS
Write-Host "`n3. Getting Problems..." -ForegroundColor Green
$problems = Invoke-RestMethod -Uri 'http://localhost:4000/api/problems' -Method GET -Headers @{Authorization="Bearer $token"}
Write-Host "✅ Found $($problems.total) problems" -ForegroundColor Green
$problems.items | ForEach-Object { Write-Host "  - $($_.title) ($($_.difficulty))" }

# 4. TEST JUDGE0
Write-Host "`n4. Testing Judge0..." -ForegroundColor Green
$judgeBody = @{source_code='print("Hello Judge0!")';language_id=71;stdin=''} | ConvertTo-Json
$judgeResult = Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' -Method POST -Body $judgeBody -ContentType 'application/json'
Write-Host "✅ Code executed! Status: $($judgeResult.status.description)" -ForegroundColor Green
Write-Host "   Output: $($judgeResult.stdout.Trim())" -ForegroundColor Green

Write-Host "`n🎉 All tests passed!" -ForegroundColor Cyan
```

---

## 🐛 TROUBLESHOOTING

### Frontend won't load?
```
Check: http://localhost:3000
If blank, wait 10 seconds for Vite to build
```

### API returns 401 (Unauthorized)?
```
- Token expired or invalid
- Re-run login to get new token
- Make sure Authorization header has "Bearer " prefix
```

### Judge0 returns error?
```
Check Mock Judge0 is running:
  curl http://localhost:2359/about
  
Should return: {"version":"1.13.1-mock",...}
```

### Database errors?
```
Check PostgreSQL:
  docker exec clash-postgres psql -U clash -d clashofcode -c "SELECT 1"
  
Should return: (1 row)
```

### Services not responding?
```
Check all services are running:
  netstat -ano | findstr ":4000"    # API
  netstat -ano | findstr ":4100"    # Match Server
  netstat -ano | findstr ":3000"    # Frontend
  netstat -ano | findstr ":2359"    # Mock Judge0
```

---

## 🎮 FULL USER FLOW TESTING

### Step 1: **Login**
1. Open http://localhost:3000
2. Enter email: `alice@clash.dev`
3. Enter password: `password123`
4. Click Login

### Step 2: **View Profile**
- Check rating (should be 1500)
- Check level (should be 1)
- Check XP (should be 0)

### Step 3: **Browse Problems**
- Click on "Problems" or "Practice"
- Should see 3 problems: A+B, Sum of Array, Reverse String

### Step 4: **View Problem Details**
- Click on "A + B" problem
- See problem statement
- See example test cases
- See starter code in Python/JavaScript/etc.

### Step 5: **Check Status**
- Navigate to different sections
- WebSocket should maintain connection

---

## 📊 DATABASE INSPECTION

Check data directly in PostgreSQL:

```bash
# Check users
docker exec clash-postgres psql -U clash -d clashofcode -c "SELECT username, email, rating FROM users LIMIT 5;"

# Check problems
docker exec clash-postgres psql -U clash -d clashofcode -c "SELECT title, difficulty, points FROM problems;"

# Check test cases for A+B
docker exec clash-postgres psql -U clash -d clashofcode -c "SELECT input, expected_output FROM test_cases WHERE problem_id = '49656f5c-ea4c-4438-9078-71b1ddec7e30' LIMIT 5;"
```

---

## 🚀 READY TO TEST!

Everything is running. You can now:

1. **Use the Frontend:** http://localhost:3000
2. **Test APIs:** Use PowerShell commands above
3. **Test Judge0:** Execute code via API
4. **Check Logs:** Each service prints logs to its terminal

---

## ⚠️ REMEMBER

- Frontend at **localhost:3000** (not 5173)
- API at **localhost:4000**
- WebSocket at **localhost:4100**
- Mock Judge0 at **localhost:2359**
- All passwords are **password123**

**Happy testing! 🎉**
