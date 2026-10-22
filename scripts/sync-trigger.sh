#!/bin/bash
# 싱크 트리거. 서버 crontab에서 실행한다 — GitHub Actions schedule은 3~4시간씩 밀려(#229) 짧은 주기를 못 지킨다.
# GitHub Actions 워크플로(continuous-sync·blog-check)는 백업으로 남는다. 겹쳐도 큐가 같은 작업에 합류시킨다
#   */10 * * * *     /home/ubuntu/app/who-tech-backend/scripts/sync-trigger.sh continuous >> /home/ubuntu/logs/sync-trigger.log 2>&1
#   7,37 * * * *     /home/ubuntu/app/who-tech-backend/scripts/sync-trigger.sh blog       >> /home/ubuntu/logs/sync-trigger.log 2>&1
#   23 * * * *       /home/ubuntu/app/who-tech-backend/scripts/sync-trigger.sh activity   >> /home/ubuntu/logs/sync-trigger.log 2>&1  (#236)
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
base_url="${SYNC_BASE_URL:-http://localhost:3000}"
secret="$(grep -E '^ADMIN_SECRET=' "$repo_dir/.env" | head -1 | cut -d= -f2- | tr -d '"')"
if [ -z "$secret" ]; then
  echo "[$(date '+%F %T')] ADMIN_SECRET not found" >&2
  exit 1
fi

case "${1:-}" in
  continuous) path="/admin/sync/continuous"; extra=() ;;
  blog) path="/admin/blog/sync"; extra=(-H "X-Sync-Source: scheduler") ;;
  # 최근 PR 활동으로 미분류 추가·continuous 전환. 끝나면 200 (#236)
  activity) path="/admin/repos/activity"; extra=() ;;
  *) echo "usage: $0 continuous|blog|activity" >&2; exit 2 ;;
esac

# continuous는 끝날 때까지 최대 240초 기다린 뒤 200(완료) 또는 202(큐에 남음), blog는 바로 202
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 300 -X POST "$base_url$path" \
  -H "Authorization: Bearer $secret" "${extra[@]}")"
echo "[$(date '+%F %T')] $1 -> $code"
[ "$code" = "200" ] || [ "$code" = "202" ]
