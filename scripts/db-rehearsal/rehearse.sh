#!/usr/bin/env bash
# DB 변경 리허설: 운영 DB 복사본에 현재 코드를 띄우고 공개·어드민 API 응답 지문과 일관성 검사 결과를 남긴다.
# 변경 전 코드와 변경 후 코드로 같은 복사본에서 각각 실행해 지문을 비교한다:
#   scripts/db-rehearsal/fetch-backup.sh /tmp/prod.db
#   git switch main && scripts/db-rehearsal/rehearse.sh /tmp/prod.db /tmp/before      # 변경 전
#   git switch <branch> && scripts/db-rehearsal/rehearse.sh /tmp/prod.db /tmp/after    # 변경 후 (백필 스크립트는 3번째 인자)
#   diff /tmp/before/fingerprint.txt /tmp/after/fingerprint.txt
# 사용: rehearse.sh <원본 복사본.db> <결과 폴더> [백필 명령]
set -euo pipefail
SOURCE="${1:?원본 복사본 경로}"
OUT="${2:?결과 폴더}"
BACKFILL="${3:-}"
PORT="${PORT:-3300}"
SECRET="rehearsal-secret"
mkdir -p "$OUT"
DB="$OUT/rehearsal.db"
cp "$SOURCE" "$DB"
export DATABASE_URL="file:$DB"

if [ -n "$BACKFILL" ]; then
  npx prisma migrate deploy >/dev/null
  echo "[rehearsal] 백필: $BACKFILL"
  bash -c "$BACKFILL" | tee "$OUT/backfill.log"
fi

ADMIN_SECRET="$SECRET" PORT="$PORT" npx tsx scripts/db-rehearsal/server.ts >"$OUT/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && break
  sleep 1
done

API_BASE="http://127.0.0.1:$PORT" ADMIN_SECRET="$SECRET" node scripts/api-fingerprint.mjs >"$OUT/fingerprint.txt"
# 일관성 검사 (src/db/consistency.ts). 위반이 있어도 결과를 남기고 계속한다
npx tsx src/scripts/check-db-consistency.ts >"$OUT/checks.txt" || true
echo "[rehearsal] 지문 $(wc -l <"$OUT/fingerprint.txt" | tr -d ' ')개 → $OUT/fingerprint.txt, 일관성 검사 → $OUT/checks.txt"
