# 🚀 QUICK START - TEST EVERYTHING NOW!

## ✅ ALL SERVICES RUNNING

```
✅ Frontend:     http://localhost:3000
✅ API:          http://localhost:4000
✅ Match Server: http://localhost:4100 (WebSocket)
✅ Judge0:       http://localhost:2359
✅ Database:     PostgreSQL (working)
✅ Cache:        Redis (working)
```

---

## 👤 TEST ACCOUNT

```
Email:    alice@clash.dev
Password: password123
```

---

## 🌐 OPEN FRONTEND NOW

### **http://localhost:3000**

1. Login with `alice@clash.dev` / `password123`
2. Browse the app
3. View problems
4. Check your profile

---

## 🔌 QUICK API TESTS

### **Copy & Paste into PowerShell:**

#### 1️⃣ **LOGIN & GET TOKEN**
```powershell
$loginBody = @{email='alice@clash.dev';password='password123'} | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$token = $login.accessToken
Write-Host "Token: $token"
```

#### 2️⃣ **GET YOUR PROFILE**
```powershell
Invoke-RestMethod -Uri 'http://localhost:4000/api/users/me' -Method GET -Headers @{Authorization="Bearer $token"} | ConvertTo-Json
```

#### 3️⃣ **GET ALL PROBLEMS**
```powershell
Invoke-RestMethod -Uri 'http://localhost:4000/api/problems' -Method GET -Headers @{Authorization="Bearer $token"} | ConvertTo-Json
```

#### 4️⃣ **TEST CODE EXECUTION**
```powershell
$code = @{source_code='print("Hello!")';language_id=71;stdin=''} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' -Method POST -Body $code -ContentType 'application/json' | ConvertTo-Json
```

#### 5️⃣ **TEST A+B SOLUTION**
```powershell
$code = @{source_code='a, b = map(int, input().split())
print(a + b)';language_id=71;stdin='5 3'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' -Method POST -Body $code -ContentType 'application/json' | ConvertTo-Json
```

---

## 📋 WHAT YOU CAN TEST

### Frontend
- ✅ Login/Logout
- ✅ View Profile
- ✅ Browse Problems
- ✅ See Problem Details
- ✅ View Examples & Starter Code

### API Endpoints
- ✅ POST /api/auth/login
- ✅ GET /api/users/me
- ✅ GET /api/problems
- ✅ GET /api/problems/:id

### Judge0 Code Execution
- ✅ Execute Python code
- ✅ Get stdout/stderr
- ✅ Get execution time
- ✅ Accept/Reject verdicts

---

## 🎯 NEXT STEPS FOR ADVANCED TESTING

### Two-User Matchmaking (Browser)
1. Open 2 browser windows
2. Tab 1: Login as alice
3. Tab 2: Login as bob
4. Both join matchmaking queue
5. Watch for match creation

### Battle Flow (When Matchmaking Works)
1. Wait for match to be created
2. Both players enter battle
3. Submit code solutions
4. See verdicts in real-time
5. See winner/loser determination

### Monitor Logs
- API logs show all requests
- Match Server logs show connections
- Judge Worker logs show job processing
- Mock Judge0 logs show code execution

---

## 🐛 IF SOMETHING BREAKS

### Check Service Status
```powershell
# API
curl http://localhost:4000/health

# Mock Judge0
curl http://localhost:2359/about

# Match Server (no health endpoint, check process)
netstat -ano | findstr ":4100"
```

### Common Issues
| Issue | Solution |
|-------|----------|
| "Connection refused" | Service not running, check process list |
| "CORS error" | Restart API with correct origin |
| "Token invalid" | Re-login to get new token |
| "Judge0 error" | Make sure it's running on 2359 |
| "Database error" | Check PostgreSQL is running |

---

## 📞 CREDENTIALS

| User | Email | Password | Rating |
|------|-------|----------|--------|
| alice | alice@clash.dev | password123 | 1500 |
| bob | bob@clash.dev | password123 | 1520 |
| carol | carol@clash.dev | password123 | 1480 |
| dave | dave@clash.dev | password123 | 1650 |

---

## 🎉 YOU'RE ALL SET!

- Frontend: **http://localhost:3000**
- APIs are ready for testing
- Code execution works
- Database is populated
- Everything is online!

**Start testing now! 🚀**

For detailed testing guide, see: `TESTING_GUIDE.md`
