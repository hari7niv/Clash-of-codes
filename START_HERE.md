# 🎮 CLASH OF CODES - START HERE

## ✅ ALL SYSTEMS GO!

```
✅ Frontend ........... http://localhost:3000
✅ API Server ......... http://localhost:4000
✅ Match Server ....... http://localhost:4100
✅ Judge0 (Mock) ...... http://localhost:2359
✅ PostgreSQL ......... Running
✅ Redis ............. Running
```

---

## 🌐 OPEN THE APP NOW!

### **http://localhost:3000**

Login with:
- **Email:** alice@clash.dev
- **Password:** password123

---

## 📚 DOCUMENTATION

Read these files for detailed info:

1. **QUICK_START.md** - Quick reference & API commands (⭐ START HERE)
2. **TESTING_GUIDE.md** - Complete testing procedures
3. **FINAL_RUNTIME_AUDIT.md** - Full technical audit
4. **CURRENT_STATUS_AND_NEXT_STEPS.md** - Status and TODOs
5. **DEBUGGING_LOG.md** - How bugs were fixed

---

## 🚀 WHAT YOU CAN DO RIGHT NOW

### In the Browser (http://localhost:3000):
- ✅ Login with test account
- ✅ View your profile
- ✅ Browse 3 problems
- ✅ See problem statements & examples
- ✅ View starter code for different languages

### Via API (PowerShell Commands):
- ✅ Login and get JWT token
- ✅ Fetch user profile
- ✅ Get list of problems
- ✅ Get problem details
- ✅ Execute code (test Judge0)

### Available Test Accounts:
```
alice@clash.dev / password123  (Rating: 1500)
bob@clash.dev / password123    (Rating: 1520)
carol@clash.dev / password123  (Rating: 1480)
dave@clash.dev / password123   (Rating: 1650)
```

---

## 🔥 QUICK TESTS

### Copy & Paste into PowerShell to test API:

```powershell
# 1. LOGIN
$loginBody = @{email='alice@clash.dev';password='password123'} | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$token = $login.accessToken
Write-Host "✅ Logged in! Token: $($token.Substring(0, 30))..."

# 2. GET PROFILE
$profile = Invoke-RestMethod -Uri 'http://localhost:4000/api/users/me' -Method GET -Headers @{Authorization="Bearer $token"}
Write-Host "✅ Profile: $($profile.name), Rating: $($profile.rating)"

# 3. GET PROBLEMS
$problems = Invoke-RestMethod -Uri 'http://localhost:4000/api/problems' -Method GET -Headers @{Authorization="Bearer $token"}
Write-Host "✅ Found $($problems.total) problems:"
$problems.items | ForEach-Object { Write-Host "   - $($_.title)" }

# 4. TEST CODE EXECUTION
$code = @{source_code='print("Hello!")';language_id=71;stdin=''} | ConvertTo-Json
$result = Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' -Method POST -Body $code -ContentType 'application/json'
Write-Host "✅ Code executed! Output: $($result.stdout.Trim())"
```

---

## 📊 AVAILABLE PROBLEMS

| # | Title | Difficulty | Topic | Points |
|---|-------|-----------|-------|--------|
| 1 | A + B | Easy | Math | 800 |
| 2 | Sum of an Array | Easy | Arrays | 1000 |
| 3 | Reverse a String | Easy | Strings | 900 |

Each problem has:
- ✅ Problem statement
- ✅ Example test cases (sample inputs/outputs)
- ✅ Hidden test cases
- ✅ Starter code in multiple languages

---

## 🧪 API ENDPOINTS READY

### Authentication
- **POST** `/api/auth/login` - Login with email/password
- **POST** `/api/auth/refresh` - Get new token
- **POST** `/api/auth/logout` - Logout
- **POST** `/api/auth/signup` - Register new user

### Users
- **GET** `/api/users/me` - Get your profile
- **GET** `/api/leaderboard` - Get rankings

### Problems
- **GET** `/api/problems` - List all problems
- **GET** `/api/problems/:id` - Get problem details

### Matchmaking (WebSocket)
- Join matchmaking queue
- Get matched with opponent
- Start battle

### Judge0 Code Execution
- **POST** `/submissions` - Execute code
- **GET** `/submissions/:token` - Check result

---

## 🛠️ WHAT'S IMPLEMENTED

### ✅ Backend
- User authentication (JWT)
- Problem storage and retrieval
- Test case management
- Code execution via Mock Judge0
- Database (PostgreSQL)
- Real-time messaging (WebSocket)
- Job queue (BullMQ)
- Matchmaking engine

### ✅ Frontend
- Login/Registration
- Profile view
- Problem browsing
- Problem details
- Code editor ready (not fully integrated)
- Responsive design

### ⏸️ In Progress
- Full battle UI
- Real-time collaboration
- Submission flow UI
- Result display
- Rating calculation display

---

## 📖 TECHNOLOGIES USED

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Fastify
- **Real-time:** Socket.io + WebSocket
- **Database:** PostgreSQL + Drizzle ORM
- **Queue:** BullMQ + Redis
- **Code Execution:** Judge0 (mock for Windows)
- **Styling:** Tailwind CSS

---

## ⚠️ KNOWN LIMITATIONS

1. **Judge0 on Windows:** 
   - Real Judge0 requires Linux cgroups
   - Using mock service (works perfectly for testing)
   - Production: Deploy on Linux with real Judge0

2. **Frontend Port:**
   - Runs on port 3000 (configured in Vite)
   - Not the default Vite port 5173

3. **Mock Judge0:**
   - Great for Python & JavaScript testing
   - No sandboxing (safe for dev only)
   - Production: Use real Judge0

---

## 🐛 IF SOMETHING DOESN'T WORK

### Check Services
```powershell
# API
curl http://localhost:4000/health

# Mock Judge0  
curl http://localhost:2359/about

# Ports in use
netstat -ano | findstr ":4000"
netstat -ano | findstr ":4100"
netstat -ano | findstr ":3000"
netstat -ano | findstr ":2359"
```

### Check Database
```bash
docker exec clash-postgres psql -U clash -d clashofcode -c "SELECT 1"
```

### Check Redis
```bash
docker exec clash-redis redis-cli ping
```

---

## 📞 SUPPORT

All issues documented in:
- `FINAL_RUNTIME_AUDIT.md` - Complete audit
- `DEBUGGING_LOG.md` - How bugs were fixed
- `TESTING_GUIDE.md` - Testing procedures

---

## 🎯 NEXT STEPS

1. **Open http://localhost:3000**
2. **Login** with alice@clash.dev / password123
3. **Explore** the app
4. **Read** QUICK_START.md for API testing
5. **Try** code execution via Judge0

---

## 🎉 YOU'RE READY!

Everything is running and tested. Start exploring!

**Questions?** Check the documentation files above.

**Happy coding! 🚀**
