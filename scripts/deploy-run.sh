#!/bin/bash
# deploy.sh가 git pull 직후 실행한다. 인자: 배포 전 커밋 SHA (실패 시 롤백 대상)
# 어느 단계든 실패하거나 /health가 새 커밋을 보고하지 않으면 이전 커밋으로 되돌린다.
# DB 마이그레이션은 자동으로 되돌리지 않는다 (배포 직전 백업 파일로 수동 복구).
set -uo pipefail

prev_sha="${1:?usage: deploy-run.sh <previous-sha>}"
target_sha="$(git rev-parse HEAD)"
app_name="${DEPLOY_APP_NAME:-backend}"
health_url="${DEPLOY_HEALTH_URL:-http://localhost:${PORT:-3000}/health}"
backup_dir="${DEPLOY_BACKUP_DIR:-$HOME/backups/who-tech/pre-deploy}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

select_node() {
  echo "--- Selecting Node version (.nvmrc) ---"
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" || return 1
  nvm install || return 1
  nvm use || return 1
  # pm2 interpreter가 가리키는 고정 경로. 버전이 바뀌어도 reload만으로 새 Node가 적용된다
  ln -sfn "$(nvm which current)" "$HOME/.who-tech-backend-node" || return 1
  echo "Node $(node -v) / npm $(npm -v)"
}

build() {
  echo "--- Installing dependencies ---"
  npm install --ignore-scripts || return 1
  npm --prefix src/public/admin-spa install --ignore-scripts || return 1
  echo "--- Generating Prisma client ---"
  npx prisma generate || return 1
  echo "--- Building ---"
  npm run build || return 1
}

backup_db() {
  echo "--- Backing up DB ---"
  local db_path="${DATABASE_URL#file:}"
  if [ ! -f "$db_path" ]; then
    echo "!!! DB file not found: $db_path"
    return 1
  fi
  mkdir -p "$backup_dir" || return 1
  local out
  out="$backup_dir/dev-$(date +%Y%m%d-%H%M%S)-${target_sha:0:7}.db"
  # 앱이 쓰는 중이면 잠금이 풀릴 때까지 최대 30초 대기 (없으면 "database is locked"로 즉시 실패)
  sqlite3 -cmd ".timeout 30000" "$db_path" ".backup '$out'" || return 1
  echo "DB backup: $out"
  # 최근 10개만 보관. 정리 실패는 배포를 막지 않는다 (unlink는 인자 1개만 받으므로 -n 1)
  find "$backup_dir" -maxdepth 1 -name '*.db' -printf '%T@ %p\n' | sort -rn | tail -n +11 | cut -d' ' -f2- |
    xargs -r -d '\n' -n 1 unlink || echo "::warning:: 오래된 백업 정리 실패 (배포는 계속)"
}

reload() {
  echo "--- Reloading PM2 ($app_name) ---"
  pm2 reload "$app_name" --update-env
}

wait_healthy() {
  local expected="$1"
  echo "--- Health check: expecting commit ${expected:0:7} ---"
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "$health_url" 2>/dev/null | grep -q "\"commit\":\"$expected\""; then
      echo "Health OK"
      return 0
    fi
    sleep 2
  done
  echo "!!! Health check failed: $health_url"
  return 1
}

rollback() {
  log "!!! $1 — rolling back to ${prev_sha:0:7} !!!"
  echo "!!! DB migrations are NOT rolled back automatically. See backup above."
  git checkout --detach "$prev_sha"
  if select_node && build && reload && wait_healthy "$prev_sha"; then
    log "Rollback completed: ${prev_sha:0:7}"
  else
    log "!!! ROLLBACK FAILED — manual intervention required !!!"
  fi
  exit 1
}

log "Target ${target_sha:0:7} (previous ${prev_sha:0:7})"

select_node || rollback "Node setup failed"
build || rollback "Build failed"
backup_db || rollback "DB backup failed (migration skipped)"

echo "--- Running migrations ---"
npx prisma migrate deploy || rollback "Migration failed"

reload || rollback "pm2 reload failed"
wait_healthy "$target_sha" || rollback "Health check failed"

log "Deploy completed successfully: ${target_sha:0:7}"
