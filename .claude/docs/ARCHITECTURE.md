# ARCHITECTURE.md — Backend 아키텍처

## 데이터 수집 흐름

```
MissionRepo (DB 등록) → fetchRepoPRs (GitHub API) → parsePRsToSubmissions → upsert Member/Submission
```

- `syncWorkspace`: DB에 등록된 모든 active 레포 수집
- `syncContinuousRepos`: syncMode=continuous 레포만 수집 (10분 cron)
- `syncRepo`: 레포 PR `sort: 'updated'` 기준, 오래된 PR을 만날 때까지(최대 10페이지) → 토큰 추출 → PR마다 트랜잭션 하나로 DB 쓰기(`sync-write.repository`)
- PR 상태 수집: `open`, `merged`, `closed` 모두 저장하며, 비병합 closed PR도 보존
- 닉네임 추출: PR 제목을 `[^가-힣]+`로 분리, 한글 토큰만 추출 (`extractNicknameTokens`)
- 닉네임 통계: 멤버의 모든 제출 제목으로 `computeNicknameStats`가 처음부터 계산(멱등) → `nicknameStats`에 빈도순 저장. 금지어(`NicknameBannedWord`) 필터 적용, 동률이면 현재 닉네임 유지
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
- `Submission`, `BlogPost`, `BlogPostLatest`, `ActivityLog`: 기존과 동일 (`BlogPost.viewCount` = who-tech 내부 클릭수)
- `TecoTalk`: videoId(unique), title, url, thumbnailUrl, speakerNickname, uploadedAt, viewCount(YouTube 조회수), cohort(업로드 연도→cohortRules 매핑), matchStatus(matched|ambiguous|unmatched), memberId? — 테코톡 재생목록 수집/멤버 매칭

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

- `feature.route` → `feature.service` → `db/repository`(Prisma) + `infra/*`(외부 연동) + `shared/*` 유틸
- 객체 조립은 `src/container.ts` 한 곳에서 한다 (저장소 → 서비스 순서로 만들고 주입). `src/app.ts`는 HTTP 설정과 라우트 연결만 한다
- 다른 기능은 그 기능의 공개 진입점(`features/<name>/index.ts`)으로만 참조한다. 기능끼리 순환 의존 금지
  - 반대 방향이 필요하면 의존받는 쪽에 포트(인터페이스)를 두고 조립 코드에서 구현을 꽂는다 (예: `features/sync/sync.ports.ts`의 `RepoSyncRunner`·`WorkspaceBlogSyncRunner`)
- `shared`·`db`·`infra`는 `features`를 모른다
- 위 규칙은 `npm run deps:check`(dependency-cruiser + `scripts/check-feature-cycles.mjs --strict`)로 CI에서 강제한다
- 별도의 엔티티 클래스 레이어는 필수 아님. Prisma 모델 + 서비스 단의 응답 shaping으로 API 계약을 맞춘다 (계약은 `src/__tests__/integration/api-contract.int.test.ts`로 고정)

## 디렉토리 구조

```
src/
  app.ts            # HTTP 설정·라우트 연결
  container.ts      # 객체 그래프 조립 (Composition Root)
  features/         # 도메인별 route + service (+ index.ts 공개 진입점)
    sync/
      sync.service.ts        # syncWorkspace, syncContinuousRepos
      sync.repo-sync.ts      # syncRepo (resolveProfile, upsertMemberAndSubmission)
      sync.pr-parser.ts      # parsePRsToSubmissions
      sync.admin.service.ts  # SSE 어댑터 (syncWorkspace/continuous 래핑)
      sync.queue.ts          # 작업 큐 (repo·blog 작업은 포트로 위임)
      sync.ports.ts          # RepoSyncRunner, WorkspaceBlogSyncRunner
    blog/
      blog.service.ts        # createBlogService (syncBlogs)
      blog.admin.service.ts  # 싱크 잡 큐, 로그 기록
      blog.backfill.ts       # backfillMemberBlogLinks
    member/
      member.service.ts      # createMemberService
      member.response.ts     # toMemberResponse 매퍼
      member.profile-refresh.ts  # refreshMemberProfileById
    repo/  workspace/        # *.validation.ts: 기능 전용 요청 검증
  infra/            # 외부 연동
    github/github.client.ts  # Octokit, fetchRepoPRs, fetchUserBlogCandidates, detectCohort
    rss/rss.ts               # RSS 수집·검사 (fetchRSSItems, probeRss, resolveRSSUrlsForBlog, isNonPostPageUrl)
  db/               # Prisma repository
  shared/           # 공통 유틸 (http 에러, 미들웨어, 쿼리 파싱 등)
  public/
    admin-spa/      # Vite + React + Tailwind SPA (빌드 → dist/public/admin-dist/)
    guide.html      # 공개 가이드 페이지
  scripts/          # 시드 등 유틸 스크립트
```
