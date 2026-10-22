# 하네스

에이전트(Claude Code·Codex·Cursor 등)가 작업하는 동안 도는 검사. 도구가 바뀌어도 같은 기준이 돌도록 **검사 본체는 도구 무관 스크립트**, 도구별로는 얇은 연결만 둔다.

| 층                 | 언제                    | 무엇                                                                                                                                         | 막나                              |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 규칙 문서          | 항상                    | CLAUDE.md·AGENTS.md·ADR. 판단이 필요한 규칙만, 기계로 검사할 수 있는 건 아래 층으로                                                          | —                                 |
| **변경 검사 (L2)** | 에이전트가 턴을 끝낼 때 | `scripts/verify-changed.sh`: 바뀐 파일 기준 typecheck(증분)·eslint·관련 테스트(jest/vitest related)·어드민 토큰 린트·prisma validate·셸 문법 | **막음** (Claude: Stop 훅 exit 2) |
| 커밋               | `git commit`            | lint-staged(prettier·eslint --fix), commitlint                                                                                               | 막음                              |
| CI                 | PR·main                 | 전체 테스트·계약 스냅샷·어드민 스크린샷·CodeQL                                                                                               | 막음                              |
| 배포 확인          | 배포 후                 | `/health` 커밋 확인(더 새 커밋도 성공, #239)                                                                                                 | 알림                              |

## 변경 검사 동작

- 바뀐 파일이 없으면 생략. 같은 변경(diff 지문)이 이미 통과했으면 생략 (`.git/harness/last-pass`)
- 실패하면 실패한 검사의 마지막 30줄만 보여 준다. Claude는 고치고 다시 끝내려 한다
- 같은 변경으로 3번 연속 실패하면 막지 않고 경고(환경 문제로 영원히 막히는 것 방지)
- 실행마다 `.git/harness/log.jsonl`에 한 줄 — 커밋되지 않는다

## 연결

- Claude Code: `.claude/settings.json` Stop → `.claude/hooks/stop-verify.sh` (레포를 스크립트 위치로 찾는다)
- 다른 도구·사람: 끝내기 전에 `scripts/verify-changed.sh`

## 측정

- `node scripts/harness-metrics.mjs --hook` — 훅 실행·막은 횟수·막은 검사·시간
- `node scripts/harness-metrics.mjs --since YYYY-MM-DD` — CI 첫 실행 실패율·추가 push·통과까지 시간
- 기준값: [baseline-2026-10-22.md](baseline-2026-10-22.md)
