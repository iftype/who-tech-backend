#!/bin/bash
set -euo pipefail

LOG_FILE="/tmp/who-tech-deploy-$(date +%s).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy started"

cd ~/app/who-tech-backend

echo "--- Stashing local changes ---"
git stash || true

echo "--- Checking out main ---"
git checkout main

echo "--- Pulling latest ---"
if ! git pull origin main; then
  echo "!!! git pull failed, resetting to origin/main !!!"
  git fetch origin main
  git reset --hard origin/main
fi

echo "--- Installing dependencies ---"
npm install --ignore-scripts
npm --prefix src/public/admin-spa install --ignore-scripts

echo "--- Generating Prisma client ---"
npx prisma generate

echo "--- Building ---"
npm run build

echo "--- Running migrations ---"
npx prisma migrate deploy

echo "--- Reloading PM2 ---"
pm2 reload backend --update-env

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy completed successfully"
echo "Log saved to: $LOG_FILE"
