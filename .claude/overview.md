# 백엔드 개요

## 스택

- Node.js 20 + TypeScript strict / Express / Prisma / SQLite
- Oracle Cloud AMD · iftype.store · PM2 · Nginx
- PM2 앱 이름: `backend`

## 아키텍처

### 데이터 수집 흐름

```
MissionRepo (DB 등록) → fetchRepoPRs (GitHub API) → parsePRsToSubmissions → upsert Member/Submission
```

- `syncWorkspace`: DB에 등록된 모든 active 레포 수집
- `syncContinuousRepos`: syncMode=continuous 레포만 수집 (10분 cron)
- PR 상태: open/merged/closed 모두 저장
- 닉네임 추출: `[^가-힣]+` 분리 → 한글 토큰 빈도 집계 (`nicknameStats`)
- 기수 판별: PR `created_at` 연도 → `cohortRules` JSON 매핑

### DI 구조

```
app.ts (composition root)
  ├── new PrismaClient()
  ├── createOctokit()
  ├── create*Repository(db)     ← Prisma 접근은 repository만
  ├── create*Service(repos)     ← repository 주입
  └── create*Router(service)    ← service 주입
```

### DB 핵심 모델

- `Workspace`: githubOrg, cohortRules(JSON), blogSyncEnabled
- `MissionRepo`: name, track(frontend|backend|android|null=공통), type, tabCategory, status(active|candidate|excluded), syncMode(continuous|once), cohorts(JSON), level
- `Member`: githubId, githubUserId, previousGithubIds, nicknameStats, blog, rssStatus, lastPostedAt, **personId?**
- `Cohort/Role/MemberCohort`: 기수·역할(crew|coach|reviewer) 정규화
- `CohortRepo`: cohort, order, missionRepoId — 기수별 미션 순서
- `Person`: 여러 githubId를 하나의 실제 인물로 연결하는 마스터 엔티티

## 배포

### 자동 배포 (GitHub Actions)

1. `main` 브랜치 push → `deploy.yml`
2. `POST https://iftype.store/admin/deploy` 웹훅 호출
3. 서버에서 detached bash: `git pull origin main && npm install --ignore-scripts && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 reload backend --update-env`

### 수동 배포

```bash
ssh oracle "cd ~/app/who-tech-backend && git pull origin main && npm install --ignore-scripts && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 reload backend --update-env"
```

### DB 초기화 (drift 발생 시)

```bash
ssh oracle "cd ~/app/backend && git pull --ff-only origin main && rm -f prisma/dev.db && npm install --ignore-scripts && npx prisma generate && npx prisma migrate deploy && npm run seed && npm run build && pm2 reload backend --update-env"
```

## 자동수집 워크플로우

- `blog-check.yml`: 매시간 `POST /admin/blog/sync` → jobId polling → Slack 알림
- `continuous-sync.yml`: 10분마다 `POST /admin/sync/continuous`
- `SYNC_URL` 시크릿 미설정 시 `https://iftype.store` fallback 사용

## 주요 명령어

```bash
npm run dev          # tsx watch
npm run build        # TypeScript 빌드
npm run test:unit    # 유닛 테스트
npm run seed         # Role + Workspace 초기화
npx prisma migrate dev  # 마이그레이션 생성+적용
```

## 어드민 주요 기능

| 기능             | 설명                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| 레포 후보 수집   | `POST /admin/repos/discover` — woowacourse 조직 공개 레포 → candidate |
| 전체/단건 Sync   | SSE 진행률, cohort 필터                                               |
| 블로그 동기화    | background job, RSS 상태, 30일 보관 + 7일 스냅샷                      |
| 멤버 관리        | 역할 토글, manualNickname, blog, 프로필 갱신                          |
| 기수 목록 재Sync | CohortRepo 등록 레포만 순서대로 재수집                                |

## 브랜치 전략

```
main     ← 배포 브랜치 (PR + 리뷰 1명)
develop  ← 기능 통합
feat/#이슈번호-설명
```
