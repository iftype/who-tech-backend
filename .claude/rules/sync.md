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

## 핵심 로직

- PR 상태: open / merged / closed 모두 저장
- 닉네임 추출: `[^가-힣]+` 분리 → 한글 토큰 빈도 집계 (`nicknameStats`)
- 기수 판별: PR `created_at` 연도 → `cohortRules` JSON 매핑
- GitHub API 레이트리밋: `@octokit/plugin-throttling` 자동 처리

## 주의사항

- `syncMode=once` 레포는 초기 수집 후 재실행 안 함
- maxPages 설정으로 대형 레포 수집량 제한 (현재 30)
- 자세한 내용: `.claude/docs/sync.md`
