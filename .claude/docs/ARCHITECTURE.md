# ARCHITECTURE.md — Backend 아키텍처

## 데이터 수집 흐름

```
MissionRepo (DB 등록) → fetchRepoPRs (GitHub API) → parsePRsToSubmissions → upsert Member/Submission
```

- `syncWorkspace`: DB에 등록된 모든 active 레포 수집
- `syncContinuousRepos`: syncMode=continuous 레포만 수집 (10분 cron)
- `syncRepo`: 레포 PR `sort: 'updated'` 기준, 최근 100개(`maxPages: 1`) → 토큰 추출 → DB upsert
- PR 상태 수집: `open`, `merged`, `closed` 모두 저장하며, 비병합 closed PR도 보존
- 닉네임 추출: PR 제목을 `[^가-힣]+`로 분리, 한글 토큰만 추출 (`extractNicknameTokens`)
- 닉네임 통계: 각 토큰을 `mergeNicknameStat`으로 누적 → `nicknameStats`에 빈도순 저장. 금지어(`NicknameBannedWord`) 필터 적용
- 기수 판별: PR `created_at` 연도 → `cohortRules` JSON 매핑
- ghost(탈퇴자) PR: `user.login === 'ghost'`이면 건너뜀

## DB 스키마 핵심

- `Workspace`: githubOrg, cohortRules(JSON), blogSyncEnabled(bool)
- `MissionRepo`: name, repoUrl, track(frontend|backend|android|**null=공통**), type(individual|integration), tabCategory, status(active|candidate|excluded), syncMode(continuous|once), lastSyncAt, cohorts(JSON 기수배열), level(Int?)
- `NicknameBannedWord`: word, workspaceId — 닉네임 토큰 필터 목록 (제출합니다, 미션 등)
- `IgnoredDomain`: domain, workspaceId — 블로그로 인정하지 않을 도메인 목록
- `CohortRepo`: cohort, order, missionRepoId, workspaceId — 기수별 미션 순서
- `Person`: displayName?, note?, workspaceId — 같은 실제 인물인 여러 Member를 하나로 묶는 마스터 엔티티
- `Member`: githubId, githubUserId?, previousGithubIds?, 닉네임 필드, avatarUrl, blog, rss\*, lastPostedAt, **personId?** 등 — **기수/역할은 `MemberCohort`로 정규화**
- `Cohort` / `Role` / `MemberCohort`: 기수 번호, 역할 이름(crew|coach|reviewer), 멤버↔기수↔역할 연결 (`npm run seed`가 Role + Workspace까지 생성)
- `Submission`, `BlogPost`, `BlogPostLatest`, `ActivityLog`: 기존과 동일

## DI 구조

```
app.ts (composition root)
  ├── new PrismaClient()
  ├── createOctokit()
  ├── create*Repository(db)     ← Prisma 접근은 repository만
  ├── create*Service(repos)     ← repository 주입
  └── create*Router(service)    ← service 주입
```

## 레이어링

- `feature.route` → `feature.service` → `db/repository`(Prisma) + `shared/*` 유틸
- 별도의 엔티티 클래스 레이어는 필수 아님. Prisma 모델 + 서비스 단의 응답 shaping으로 API 계약을 맞춘다.
- 규칙이 복잡해지면 service 내부 순수 함수나 소형 타입부터 도입하고, 여러 feature에서 쓰이면 `shared/`로 승격한다.

## 디렉토리 구조

```
src/
  features/         # 도메인별 route + service
    sync/
      sync.service.ts        # syncWorkspace, syncContinuousRepos
      sync.repo-sync.ts      # syncRepo (resolveProfile, upsertMemberAndSubmission)
      sync.pr-parser.ts      # parsePRsToSubmissions
      sync.admin.service.ts  # SSE 어댑터 (syncWorkspace/continuous 래핑)
      github.service.ts      # fetchRepoPRs, fetchUserBlogCandidates
    blog/
      blog.service.ts        # createBlogService (syncBlogs)
      blog.rss.ts            # RSS 유틸 (probeRss, resolveRSSUrlsForBlog 등)
      blog.admin.service.ts  # 싱크 잡 큐, 로그 기록
      blog.backfill.ts       # backfillMemberBlogLinks
    member/
      member.service.ts      # createMemberService
      member.response.ts     # toMemberResponse 매퍼
      member.profile-refresh.ts  # refreshMemberProfileById
  db/               # Prisma repository
  shared/           # 공통 유틸
  public/
    admin-spa/      # Vite + React + Tailwind SPA (빌드 → dist/public/admin-dist/)
    guide.html      # 공개 가이드 페이지
  scripts/          # 시드 등 유틸 스크립트
```
