# Cleanup script for stray Docker containers
# Run this if you see duplicate containers (worker-1, db-1, redis-1, etc.)

Write-Host "🔍 Checking current Docker containers..." -ForegroundColor Cyan
docker ps -a

Write-Host ""
Write-Host "📋 Listing Docker Compose projects..." -ForegroundColor Cyan
docker compose ls

Write-Host ""
Write-Host "⚠️  This script will remove stray containers NOT part of the main stacks." -ForegroundColor Yellow
Write-Host "   Safe containers (will NOT be touched):" -ForegroundColor Yellow
Write-Host "   - server-1, workers-1, judge0-db-1, judge0-redis-1 (Judge0 stack)" -ForegroundColor Yellow
Write-Host "   - clash-postgres, clash-redis (Main app stack)" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Continue? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🧹 Stopping and removing stray containers..." -ForegroundColor Cyan

# Stop and remove common stray container names
$strayContainers = @("worker-1", "db-1", "redis-1")

foreach ($container in $strayContainers) {
    $exists = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$container$" -Quiet
    if ($exists) {
        Write-Host "  Removing $container..." -ForegroundColor Yellow
        docker stop $container 2>$null
        docker rm $container 2>$null
    }
}

Write-Host ""
Write-Host "🔄 Restarting Judge0 stack cleanly..." -ForegroundColor Cyan

# Get script directory and workspace root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $scriptPath

Push-Location $workspaceRoot

docker compose -f infra/judge0/docker-compose.judge0.yml down
Write-Host "  Waiting 3 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 3
docker compose -f infra/judge0/docker-compose.judge0.yml up -d

Pop-Location

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Current containers:" -ForegroundColor Cyan
docker ps

Write-Host ""
Write-Host "💡 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Check logs: docker logs -f workers-1" -ForegroundColor White
Write-Host "   2. Submit a test from your app" -ForegroundColor White
Write-Host "   3. Watch for isolate errors in the logs" -ForegroundColor White
Write-Host ""
Write-Host "📖 For detailed troubleshooting, see JUDGE0_TROUBLESHOOTING.md" -ForegroundColor Cyan
