#!/bin/bash
# 바뀐 파일만 빠르게 검사한다 (하네스 L2). 어떤 도구에서든 같은 스크립트를 부른다:
#   Claude Code — .claude/hooks/stop-verify.sh (Stop 훅), 그 밖 — 직접 실행 `scripts/verify-changed.sh`
# 성공 0, 실패 1. 실패 내용은 stderr. 실행마다 .git/harness/log.jsonl에 한 줄 (scripts/harness-metrics.mjs --hook)
# 같은 변경(지문)이 이미 통과했으면 다시 검사하지 않는다
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$root"
state=".git/harness"; mkdir -p "$state"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 && nvm use >/dev/null 2>&1

changed="$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u | while read -r f; do [ -f "$f" ] && echo "$f"; done)"
now_ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
log() { printf '%s\n' "$1" >> "$state/log.jsonl"; }
started="$(now_ms)"

if [ -z "$changed" ]; then
  log "{\"ts\":$started,\"result\":\"skip\",\"reason\":\"no-changes\",\"checks\":[],\"ms\":0}"
  exit 0
fi

fingerprint="$( { git diff HEAD; git ls-files --others --exclude-standard | while read -r f; do [ -f "$f" ] && { echo "$f"; cat "$f"; }; done; } | shasum | cut -c1-16)"
if [ "$(cat "$state/last-pass" 2>/dev/null)" = "$fingerprint" ]; then
  log "{\"ts\":$started,\"fp\":\"$fingerprint\",\"result\":\"skip\",\"reason\":\"already-passed\",\"checks\":[],\"ms\":0}"
  exit 0
fi

server_ts="$(echo "$changed" | grep -E '^src/.*\.ts$' | grep -v '^src/public/admin-spa/' || true)"
admin="$(echo "$changed" | grep -E '^src/public/admin-spa/src/.*\.(ts|tsx)$' || true)"
schema="$(echo "$changed" | grep -E '^prisma/schema\.prisma$' || true)"
scripts_sh="$(echo "$changed" | grep -E '^scripts/.*\.sh$' || true)"

checks_json=""; failed=0; report=""
run() { # 이름 명령...
  local name="$1"; shift
  local t0 out code; t0="$(now_ms)"
  out="$("$@" 2>&1)"; code=$?
  local ms=$(( $(now_ms) - t0 ))
  local ok=true; [ $code -ne 0 ] && { ok=false; failed=1; report+=$'\n'"### $name 실패"$'\n'"$(echo "$out" | grep -v '^\s*$' | tail -30)"$'\n'; }
  checks_json+="${checks_json:+,}{\"name\":\"$name\",\"ok\":$ok,\"ms\":$ms}"
}

# 훅은 논리 오류를 잡는 용도. 기계가 바쁠 때 5초 타임아웃으로 막지 않게 테스트는 시간·작업자를 넉넉히 (속도 회귀는 CI 몫)
if [ -n "$server_ts" ]; then
  # 증분 정보를 .git/harness에 둬 두 번째 실행부터 빠르다 (저장소에는 안 남음)
  run typecheck npx tsc --noEmit -p . --incremental --tsBuildInfoFile "$state/tsc-server.tsbuildinfo"
  # shellcheck disable=SC2086
  run eslint npx eslint --no-warn-ignored $server_ts
  # shellcheck disable=SC2086
  run jest-related env NODE_OPTIONS=--experimental-vm-modules npx jest --findRelatedTests $server_ts --passWithNoTests --silent --testTimeout=30000 --maxWorkers=2
fi
if [ -n "$admin" ]; then
  # tsconfig.json은 files:[] + references 묶음이라 -p로 부르면 아무것도 검사하지 않는다 → 실제 설정 tsconfig.app.json
  run admin-typecheck npx tsc --noEmit -p src/public/admin-spa/tsconfig.app.json --incremental --tsBuildInfoFile "$state/tsc-admin.tsbuildinfo"
  run admin-tokens node src/public/admin-spa/scripts/check-design-tokens.mjs
  abs="$(echo "$admin" | sed "s#^#$root/#" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  run admin-vitest bash -c "cd src/public/admin-spa && npx vitest related --run $abs --passWithNoTests --testTimeout=30000 --maxWorkers=2"
fi
[ -n "$schema" ] && run prisma-validate npx prisma validate
for f in $scripts_sh; do run "bash-n:$f" bash -n "$f"; done

ms=$(( $(now_ms) - started ))
files=$(echo "$changed" | wc -l | tr -d ' ')
if [ $failed -eq 0 ]; then
  echo "$fingerprint" > "$state/last-pass"
  log "{\"ts\":$started,\"fp\":\"$fingerprint\",\"files\":$files,\"result\":\"pass\",\"checks\":[${checks_json}],\"ms\":$ms}"
  exit 0
fi
log "{\"ts\":$started,\"fp\":\"$fingerprint\",\"files\":$files,\"result\":\"fail\",\"checks\":[${checks_json}],\"ms\":$ms}"
echo "변경 검사 실패 (scripts/verify-changed.sh) — 고친 뒤 끝내세요:$report" >&2
exit 1
