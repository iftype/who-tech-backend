---
paths:
  - 'prisma/**'
---

# DB 스키마 규칙

## 마이그레이션 워크플로우

`/migrate` 커맨드 사용 (직접 실행 금지):

1. `npx prisma migrate status` — 현재 상태 확인
2. 마이그레이션 이름 확인 후 `npx prisma migrate dev --name <name>`
3. `npx prisma generate` — client 재생성

## 핵심 모델 관계

```
Workspace (1) ──── (N) MissionRepo
MissionRepo (1) ── (N) CohortRepo
Member (N) ─────── (1) Person (선택)
Member (N) ─────── (N) Cohort (MemberCohort)
Member (1) ─────── (N) Submission
```

## 주요 모델 필드

- `MissionRepo`: track(frontend|backend|android|null), syncMode(continuous|once), status(active|candidate|excluded)
- `Member`: githubId, nicknameStats(JSON), rssStatus, personId(nullable)
- `Workspace`: githubOrg, cohortRules(JSON), blogSyncEnabled

## 주의

- SQLite 사용 중 — JSON 필드는 string으로 저장, 앱에서 파싱
- 자세한 스키마: `.claude/docs/ARCHITECTURE.md`
