#!/bin/bash
# 운영 SQLite 일일 백업. 서버 crontab에서 실행한다 (설치·복구 절차: .claude/docs/backup.md)
#   17 3 * * * /home/ubuntu/app/who-tech-backend/scripts/backup-db.sh >> /home/ubuntu/backups/who-tech/backup.log 2>&1
# - sqlite3 .backup: 서비스 중에도 일관된 스냅샷
# - PRAGMA integrity_check 통과한 것만 남기고 gzip, 14일 보관
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
backup_dir="${BACKUP_DIR:-$HOME/backups/who-tech/daily}"
keep_days="${BACKUP_KEEP_DAYS:-14}"

db_url="$(grep -E '^DATABASE_URL=' "$repo_dir/.env" | head -1 | cut -d= -f2- | tr -d '"')"
db_path="${db_url#file:}"
if [ ! -f "$db_path" ]; then
  echo "[$(date '+%F %T')] DB not found: $db_path" >&2
  exit 1
fi

mkdir -p "$backup_dir"
out="$backup_dir/dev-$(date +%Y%m%d-%H%M%S).db"
sqlite3 "$db_path" ".backup '$out'"

result="$(sqlite3 "$out" 'PRAGMA integrity_check;')"
if [ "$result" != "ok" ]; then
  echo "[$(date '+%F %T')] integrity_check failed: $result" >&2
  exit 1
fi

gzip "$out"
find "$backup_dir" -maxdepth 1 -name 'dev-*.db.gz' -mtime +"$keep_days" -delete
echo "[$(date '+%F %T')] backup ok: $out.gz ($(du -h "$out.gz" | cut -f1))"
