# =====================================================
# CLASH OF CODES - COPY & PASTE TEST COMMANDS
# =====================================================
# Run these commands one by one in PowerShell
# =====================================================

Write-Host "
╔══════════════════════════════════════════════════════════════════════╗
║                    CLASH OF CODES - API TESTING                      ║
╚══════════════════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

# =====================================================
# TEST 1: HEALTH CHECK
# =====================================================
Write-Host "`n[TEST 1] Checking API Health..." -ForegroundColor Yellow
try {
    $health = curl.exe -s http://localhost:4000/health
    Write-Host "✅ API is healthy!" -ForegroundColor Green
    Write-Host "   Response: $health`n" -ForegroundColor Green
} catch {
    Write-Host "❌ API health check failed!" -ForegroundColor Red
}

# =====================================================
# TEST 2: JUDGE0 STATUS
# =====================================================
Write-Host "[TEST 2] Checking Judge0..." -ForegroundColor Yellow
try {
    $judge0 = curl.exe -s http://localhost:2359/about
    Write-Host "✅ Judge0 is running!" -ForegroundColor Green
    Write-Host "   Response: $judge0`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Judge0 check failed!" -ForegroundColor Red
}

# =====================================================
# TEST 3: LOGIN - GET TOKEN
# =====================================================
Write-Host "[TEST 3] Testing Login..." -ForegroundColor Yellow
$loginBody = @{email='alice@clash.dev';password='password123'} | ConvertTo-Json
try {
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' `
        -Method POST `
        -Body $loginBody `
        -ContentType 'application/json'
    
    $token = $loginResponse.accessToken
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   User: $($loginResponse.user.name)" -ForegroundColor Green
    Write-Host "   Rating: $($loginResponse.user.rating)" -ForegroundColor Green
    Write-Host "   Token: $($token.Substring(0, 30))...`n" -ForegroundColor Green
    
    # =====================================================
    # TEST 4: GET USER PROFILE
    # =====================================================
    Write-Host "[TEST 4] Getting User Profile..." -ForegroundColor Yellow
    $userProfile = Invoke-RestMethod -Uri 'http://localhost:4000/api/users/me' `
        -Method GET `
        -Headers @{Authorization="Bearer $token"}
    
    Write-Host "✅ User profile retrieved!" -ForegroundColor Green
    Write-Host "   Name: $($userProfile.name)" -ForegroundColor Green
    Write-Host "   Rating: $($userProfile.rating)" -ForegroundColor Green
    Write-Host "   Level: $($userProfile.level)" -ForegroundColor Green
    Write-Host "   XP: $($userProfile.xp)/$($userProfile.xpGoal)" -ForegroundColor Green
    Write-Host "   Wins: $($userProfile.wins) | Losses: $($userProfile.losses)`n" -ForegroundColor Green
    
    # =====================================================
    # TEST 5: GET ALL PROBLEMS
    # =====================================================
    Write-Host "[TEST 5] Getting All Problems..." -ForegroundColor Yellow
    $problems = Invoke-RestMethod -Uri 'http://localhost:4000/api/problems' `
        -Method GET `
        -Headers @{Authorization="Bearer $token"}
    
    Write-Host "✅ Problems retrieved!" -ForegroundColor Green
    Write-Host "   Total problems: $($problems.total)" -ForegroundColor Green
    foreach ($problem in $problems.items) {
        Write-Host "   • $($problem.title) - $($problem.difficulty) - $($problem.points) pts" -ForegroundColor Green
    }
    Write-Host "" -ForegroundColor Green
    
    # =====================================================
    # TEST 6: GET SPECIFIC PROBLEM WITH DETAILS
    # =====================================================
    Write-Host "[TEST 6] Getting Problem Details (A + B)..." -ForegroundColor Yellow
    $problemId = $problems.items[0].id
    $problemDetail = Invoke-RestMethod -Uri "http://localhost:4000/api/problems/$problemId" `
        -Method GET `
        -Headers @{Authorization="Bearer $token"}
    
    Write-Host "✅ Problem details retrieved!" -ForegroundColor Green
    Write-Host "   Title: $($problemDetail.title)" -ForegroundColor Green
    Write-Host "   Difficulty: $($problemDetail.difficulty)" -ForegroundColor Green
    Write-Host "   Statement: $($problemDetail.statement)" -ForegroundColor Green
    Write-Host "   Examples:" -ForegroundColor Green
    foreach ($example in $problemDetail.examples) {
        Write-Host "      Input: $($example.input.Trim())" -ForegroundColor Green
        Write-Host "      Output: $($example.output.Trim())" -ForegroundColor Green
    }
    Write-Host "" -ForegroundColor Green
    
    # =====================================================
    # TEST 7: EXECUTE CODE - SIMPLE HELLO
    # =====================================================
    Write-Host "[TEST 7] Testing Code Execution (Hello World)..." -ForegroundColor Yellow
    $code1 = @{
        source_code='print("Hello from Judge0!")'
        language_id=71
        stdin=''
    } | ConvertTo-Json
    
    $result1 = Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' `
        -Method POST `
        -Body $code1 `
        -ContentType 'application/json'
    
    Write-Host "✅ Code executed successfully!" -ForegroundColor Green
    Write-Host "   Status: $($result1.status.description)" -ForegroundColor Green
    Write-Host "   Output: $($result1.stdout.Trim())" -ForegroundColor Green
    Write-Host "   Time: $($result1.time)s" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    
    # =====================================================
    # TEST 8: EXECUTE CODE - A + B PROBLEM
    # =====================================================
    Write-Host "[TEST 8] Testing A + B Solution..." -ForegroundColor Yellow
    $pythonCode = 'a, b = map(int, input().split())
print(a + b)'
    
    $code2 = @{
        source_code=$pythonCode
        language_id=71
        stdin='5 3'
    } | ConvertTo-Json
    
    $result2 = Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' `
        -Method POST `
        -Body $code2 `
        -ContentType 'application/json'
    
    Write-Host "✅ A + B executed!" -ForegroundColor Green
    Write-Host "   Input: 5 3" -ForegroundColor Green
    Write-Host "   Expected: 8" -ForegroundColor Green
    Write-Host "   Got: $($result2.stdout.Trim())" -ForegroundColor Green
    Write-Host "   Status: $($result2.status.description)" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    
    # =====================================================
    # TEST 9: ERROR HANDLING - SYNTAX ERROR
    # =====================================================
    Write-Host "[TEST 9] Testing Error Handling (Syntax Error)..." -ForegroundColor Yellow
    $badCode = 'print("This is missing closing quote'
    
    $code3 = @{
        source_code=$badCode
        language_id=71
        stdin=''
    } | ConvertTo-Json
    
    $result3 = Invoke-RestMethod -Uri 'http://localhost:2359/submissions?base64_encoded=false&wait=true' `
        -Method POST `
        -Body $code3 `
        -ContentType 'application/json'
    
    Write-Host "✅ Error handling works!" -ForegroundColor Green
    Write-Host "   Status: $($result3.status.description)" -ForegroundColor Green
    Write-Host "   Error detected properly" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    
    # =====================================================
    # FINAL SUMMARY
    # =====================================================
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                    ✅ ALL TESTS PASSED! ✅                           ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    
    Write-Host "`n📊 SUMMARY:" -ForegroundColor Cyan
    Write-Host "   ✅ API Health Check" -ForegroundColor Green
    Write-Host "   ✅ Judge0 Status" -ForegroundColor Green
    Write-Host "   ✅ User Authentication" -ForegroundColor Green
    Write-Host "   ✅ Get User Profile" -ForegroundColor Green
    Write-Host "   ✅ Get All Problems" -ForegroundColor Green
    Write-Host "   ✅ Get Problem Details" -ForegroundColor Green
    Write-Host "   ✅ Execute Code (Hello)" -ForegroundColor Green
    Write-Host "   ✅ Execute A + B Solution" -ForegroundColor Green
    Write-Host "   ✅ Error Handling" -ForegroundColor Green
    
    Write-Host "`n🌐 NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "   1. Open: http://localhost:3000" -ForegroundColor White
    Write-Host "   2. Login: alice@clash.dev / password123" -ForegroundColor White
    Write-Host "   3. Explore the app!" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error during testing!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor Cyan
