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

echo "--- Selecting Node version (.nvmrc) ---"
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install
nvm use
# pm2 interpreter가 가리키는 고정 경로. 버전이 바뀌어도 reload만으로 새 Node가 적용된다
ln -sfn "$(nvm which current)" "$HOME/.who-tech-backend-node"
echo "Node $(node -v) / npm $(npm -v)"

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
