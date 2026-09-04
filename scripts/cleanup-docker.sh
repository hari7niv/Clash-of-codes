#!/bin/bash

# Cleanup script for stray Docker containers
# Run this if you see duplicate containers (worker-1, db-1, redis-1, etc.)

echo "🔍 Checking current Docker containers..."
docker ps -a

echo ""
echo "📋 Listing Docker Compose projects..."
docker compose ls

echo ""
echo "⚠️  This script will remove stray containers NOT part of the main stacks."
echo "   Safe containers (will NOT be touched):"
echo "   - server-1, workers-1, judge0-db-1, judge0-redis-1 (Judge0 stack)"
echo "   - clash-postgres, clash-redis (Main app stack)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🧹 Stopping and removing stray containers..."

# Stop and remove common stray container names
STRAY_CONTAINERS=("worker-1" "db-1" "redis-1")

for container in "${STRAY_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "  Removing ${container}..."
        docker stop "${container}" 2>/dev/null
        docker rm "${container}" 2>/dev/null
    fi
done

echo ""
echo "🔄 Restarting Judge0 stack cleanly..."
cd "$(dirname "$0")/.." || exit

docker compose -f infra/judge0/docker-compose.judge0.yml down
echo "  Waiting 3 seconds..."
sleep 3
docker compose -f infra/judge0/docker-compose.judge0.yml up -d

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Current containers:"
docker ps

echo ""
echo "💡 Next steps:"
echo "   1. Check logs: docker logs -f workers-1"
echo "   2. Submit a test from your app"
echo "   3. Watch for isolate errors in the logs"
