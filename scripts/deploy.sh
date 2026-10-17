#!/bin/bash
# 배포 진입점. /admin/deploy가 backend 프로세스의 자식으로 실행한다.
# - pm2 reload가 backend 프로세스 트리를 정리할 때 같이 죽지 않도록 init 밑으로 분리해 다시 실행
# - 전체를 main()으로 감싸 bash가 파일을 끝까지 읽은 뒤 실행 (git pull로 이 파일이 바뀌어도 안전)
# - pull 이후 단계는 새로 받은 deploy-run.sh가 수행
set -euo pipefail

if [ -z "${WHO_TECH_DEPLOY_DETACHED:-}" ]; then
  WHO_TECH_DEPLOY_DETACHED=1 setsid -f bash "$0" "$@" </dev/null >/dev/null 2>&1
  exit 0
fi

main() {
  local deploy_dir="${DEPLOY_DIR:-$HOME/app/who-tech-backend}"
  local branch="${DEPLOY_BRANCH:-main}"
  local log_file
  log_file="/tmp/who-tech-deploy-$(date +%s).log"
  exec > >(tee -a "$log_file") 2>&1

  # 배포가 겹치지 않도록 직렬화 (앞 배포가 끝날 때까지 대기)
  exec 9>"/tmp/who-tech-deploy-$(basename "$deploy_dir").lock"
  flock -w 900 9

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy started"
  cd "$deploy_dir"

  local prev_sha
  prev_sha="$(git rev-parse HEAD)"

  echo "--- Stashing local changes ---"
  git stash || true

  echo "--- Checking out $branch ---"
  git checkout "$branch"

  echo "--- Pulling latest ---"
  if ! git pull origin "$branch"; then
    echo "!!! git pull failed, resetting to origin/$branch !!!"
    git fetch origin "$branch"
    git reset --hard "origin/$branch"
  fi

  exec bash scripts/deploy-run.sh "$prev_sha"
}

main "$@"
