#!/usr/bin/env bash
# 운영 DB의 일관된 복사본을 로컬로 가져온다 (sqlite3 .backup → scp). 운영 DB에는 쓰지 않는다
# 사용: scripts/db-rehearsal/fetch-backup.sh <저장할 경로.db>
set -euo pipefail
DEST="${1:?저장할 경로를 주세요}"
REMOTE_DB="/home/ubuntu/app/who-tech-backend/prisma/prisma/dev.db"
REMOTE_TMP="/tmp/who-tech-rehearsal-$(date +%s).db"
ssh oracle "sqlite3 '$REMOTE_DB' '.timeout 30000' \".backup '$REMOTE_TMP'\""
scp -q "oracle:$REMOTE_TMP" "$DEST"
ssh oracle "rm -f '$REMOTE_TMP'"
echo "운영 DB 복사본: $DEST ($(du -h "$DEST" | cut -f1))"
