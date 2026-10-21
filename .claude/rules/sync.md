---
paths:
  - 'src/features/sync/**'
---

# Sync 모듈

## 주요 진입점

| 함수                    | 역할                                   |
| ----------------------- | -------------------------------------- |
| `syncWorkspace`         | DB의 모든 active 레포 수집             |
| `syncContinuousRepos`   | syncMode=continuous 레포만 (10분 cron) |
| `fetchRepoPRs`          | GitHub API로 PR 목록 조회              |
| `parsePRsToSubmissions` | PR → Submission 변환                   |
| `createSyncQueue`       | in-memory 작업 큐 (순차 처리, 취소)    |

## 핵심 로직

- PR 상태: open / merged / closed 모두 저장
- 닉네임 추출: `[^가-힣]+` 분리 → 한글 토큰 빈도 집계 (`nicknameStats`)
- 기수 판별: PR `created_at` 연도 → `cohortRules` JSON 매핑
- GitHub API 레이트리밋: `@octokit/plugin-throttling` 자동 처리
- **AbortSignal**: 취소 시 GitHub API fetch 즉시 중단 (`request: { signal }`)

## 작업 큐 (SyncQueue)

- `enqueue(type, cohort?)` → job id 반환
- `getJobs()` → 전체 작업 목록
- `cancel(id)` → queued/running 작업 취소
- `subscribeProgress(id, cb)` / `subscribeDone(id, cb)` → SSE용
- Worker는 순차 처리 (한 번에 하나의 job만 running)
- 직접 싱크 라우트(`POST /sync`·`/sync/continuous`·`/sync/cohort-repos`, SSE 3개)도 큐를 거친다: `findActive`로 같은 작업에 붙고 `waitFor`로 기다린다. POST는 `REQUEST_WAIT_MS`(240초, nginx 300초보다 짧게)까지만 기다리고 202

## 주의사항

- `syncMode=once` 레포는 초기 수집 후 재실행 안 함
- 수집량 상한: 전체 싱크 30페이지, 증분 싱크는 오래된 PR을 만날 때까지 최대 10페이지
- 전체 싱크 시 `sort: 'created', direction: 'asc'` → 오래된 PR부터 수집
- `lastSyncAt` 초기화 시 해당 레포 전체 재수집
- 자세한 내용: `.claude/docs/sync.md`
