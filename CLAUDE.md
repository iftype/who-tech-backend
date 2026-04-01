# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

우아한테크코스 크루(멤버) 검색 서비스의 백엔드. GitHub 조직(`woowacourse`)의 미션 레포 PR을 수집해 멤버 정보를 저장한다.

- **레포**: https://github.com/iftype/who-tech-backend
- **서버**: Oracle Cloud AMD, iftype.store, SSH: `ssh oracle`
- **PM2 앱 이름**: `backend`

## 주요 명령어

```bash
# 개발
npm run dev              # tsx watch 핫리로드

# DB
npx prisma migrate dev   # 마이그레이션 생성 + 적용
npx prisma migrate deploy # 프로덕션 마이그레이션 적용
npm run seed             # Role + Workspace (미션 레포는 어드민 discover/sync)

# 스키마 대개편 후 마이그레이션 폴더를 비우고 다시 만들기 → README「스키마를 재조정한 뒤…」절차 참고

# 테스트
npm run test:unit        # 유닛 테스트 (CI에서 실행)
npm run test:integration # 통합 테스트 (로컬, DB 필요)
NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/unit/foo.test.ts  # 단일 파일

# 린트/포맷
npm run lint:fix
npm run format
```

## 아키텍처

### 데이터 수집 흐름

```
MissionRepo (DB 등록) → fetchRepoPRs (GitHub API) → parsePRsToSubmissions → upsert Member/Submission
```

- `syncWorkspace`: DB에 등록된 레포만 수집 (동적 org 탐색 없음)
- `syncRepo`: 레포 PR 전체 페이지네이션 → 토큰 추출 → DB upsert
- 닉네임 추출: PR 제목을 `[^가-힣]+`로 분리, 한글 토큰만 추출 (`extractNicknameTokens`)
- 닉네임 통계: 각 토큰을 `mergeNicknameStat`으로 누적 → `nicknameStats`에 빈도순 저장. 금지어(`NicknameBannedWord`) 필터 적용
- 기수 판별: PR `created_at` 연도 → `cohortRules` JSON 매핑

### DB 스키마 핵심

- `Workspace`: githubOrg, cohortRules(JSON), blogSyncEnabled(bool)
- `MissionRepo`: name, repoUrl, track(frontend|backend|android|**null=공통**), type(individual|integration), tabCategory, status(active|candidate|excluded), syncMode(continuous|once), lastSyncAt, cohorts(JSON 기수배열), level(Int?)
- `NicknameBannedWord`: word, workspaceId — 닉네임 토큰 필터 목록 (제출합니다, 미션 등)
- `IgnoredDomain`: domain, workspaceId — 블로그로 인정하지 않을 도메인 목록
- `CohortRepo`: cohort, order, missionRepoId, workspaceId — 기수별 미션 순서
- `Person`: displayName?, note?, workspaceId — 같은 실제 인물인 여러 Member를 하나로 묶는 마스터 엔티티
- `Member`: githubId, githubUserId?, previousGithubIds?, 닉네임 필드, avatarUrl, blog, rss\*, lastPostedAt, **personId?** 등 — **기수/역할은 `MemberCohort`로 정규화**
- `Cohort` / `Role` / `MemberCohort`: 기수 번호, 역할 이름(crew|coach|reviewer), 멤버↔기수↔역할 연결 (`npm run seed`가 Role + Workspace까지 생성)
- `Submission`, `BlogPost`, `BlogPostLatest`, `ActivityLog`: 기존과 동일

### 레이어링 (도메인 엔티티 클래스)

- `feature.route` → `feature.service` → `db/repository`(Prisma) + `shared/*` 유틸 로 충분한 편이며, **별도의 엔티티 클래스 레이어는 필수 아님**. Prisma 모델 + 서비스 단의 응답 shaping으로 API 계약을 맞춘다.
- 규칙이 복잡해지면 service 내부 순수 함수나 소형 타입부터 도입하고, 여러 feature에서 쓰이면 `shared/`로 승격한다.

### API 구조

```
GET  /admin/status                    — 수집 현황 (memberCount, lastSyncAt)
GET  /admin/workspace                 — workspace 설정 조회
PUT  /admin/workspace                 — cohortRules, blogSyncEnabled 수정
GET  /admin/repos                     — 미션 레포 목록 (?status=)
POST /admin/repos                     — 레포 추가 (name, repoUrl, track, type?, syncMode?, cohorts?, level?)
POST /admin/repos/discover            — 조직 공개 레포 탐색 → once candidate 갱신 (precourse 제외)
PATCH /admin/repos/:id                — track, status, syncMode, cohorts, level 등 수정
DELETE /admin/repos                   — 전체 레포 + 관련 submission 삭제
DELETE /admin/repos/:id               — 레포 + 관련 submission 트랜잭션 삭제
POST /admin/repos/:id/sync            — 단건 레포 sync
POST /admin/sync                      — once+미수집 레포만 대상으로 전체 sync (SSE 없이, ?cohort= 기수 필터)
GET  /admin/sync/stream               — sync 진행 SSE (?token= 인증, ?cohort= 기수 필터, progress/done/error 이벤트)
GET  /admin/cohort-repos              — 기수별 레포 목록 (?cohort= 필수)
GET  /admin/cohort-repos/cohorts      — CohortRepo에 등록된 기수 목록
POST /admin/cohort-repos              — 기수 레포 추가 (cohort, missionRepoId, order?)
POST /admin/cohort-repos/auto-fill    — active 레포 cohorts 필드 기반 자동 채우기 (?cohort= 필수)
PATCH /admin/cohort-repos/:id         — order 수정
DELETE /admin/cohort-repos/:id        — 기수 레포 삭제
GET  /admin/members                   — 멤버 목록 (?q=&cohort=&hasBlog=&track=&role=)
POST /admin/members                   — 멤버 수동 생성 (githubId, nickname?, cohort?, roles?, blog?)
GET  /admin/members/:id/blog-posts    — 블로그 글 목록 (archive 30일 + latest 7일)
PATCH /admin/members/:id              — manualNickname, blog, roles 수정
DELETE /admin/members                 — 전체 멤버 + submissions + blogPosts 삭제
DELETE /admin/members/:id             — 멤버 + submissions + blogPosts 삭제
POST /admin/blog/sync                 — 블로그 RSS 전체 sync (blogSyncEnabled 체크)
POST /admin/blog/backfill             — GitHub profile blog 백필 (?limit=30&cohort= 기수 필터)
GET  /admin/logs                      — 어드민 활동 로그 조회 (최근 200개)
POST /admin/logs                      — 로그 기록 (type, message)
DELETE /admin/logs                    — 전체 로그 삭제
GET  /admin/persons                   — Person 마스터 목록 (연결된 멤버 포함)
POST /admin/persons                   — Person 생성 (displayName?, note?, memberIds?)
PATCH /admin/persons/:id              — displayName, note 수정
DELETE /admin/persons/:id             — Person 삭제 (멤버 personId 자동 해제)
POST /admin/persons/:id/members/:memberId   — 멤버 → Person 연결
DELETE /admin/persons/:id/members/:memberId — 연결 해제
GET  /admin/banned-words              — 금지어 목록
POST /admin/banned-words              — 금지어 추가 (body: {word})
DELETE /admin/banned-words/:id        — 금지어 삭제
GET  /admin/ignored-domains           — 무시 도메인 목록
POST /admin/ignored-domains           — 도메인 추가 (body: {domain})
DELETE /admin/ignored-domains/:id     — 도메인 삭제
GET  /admin/archive                   — 기수별 아카이브 마크다운 (?cohort= 필수, ?track= 선택, ?format=md 텍스트 응답)
GET  /admin/blog/new-posts            — 최근 수집된 새 블로그 글 (?sinceMinutes=65)
```

모든 `/admin` 엔드포인트는 `Authorization: Bearer <ADMIN_SECRET>` 필요.
어드민 UI: `GET /admin/ui/admin.html` — 정적 JS는 `admin/` 디렉터리 ES 모듈(`main.js` 엔트리, `window`에 핸들러 노출로 기존 `onclick` 유지)

### 공개 API (인증 불필요)

```
GET  /members                     — 멤버 검색 (?q=&cohort=&track=&role=) → [{githubId, nickname, avatarUrl, cohort, roles, tracks}]
GET  /members/feed                — 최근 블로그 피드 (?cohort=&track=) → [{url, title, publishedAt, member}]
GET  /members/:githubId           — 멤버 상세 → {githubId, nickname, avatarUrl, cohort, roles, tracks, blog, lastPostedAt, submissions, blogPosts}
```

`submissions` 응답: `[{ prUrl, prNumber, title, submittedAt, missionRepo: { name, track, level, tabCategory } }]`
`blogPosts` 응답: `BlogPostLatest` 최근 10개 (7일 스냅샷 기준)

## 테스트 구조

- `__tests__/unit/` — mock 기반, DB 불필요. CI(`test.yml`)에서 실행
- `__tests__/integration/` — 실제 SQLite DB. 로컬에서만 실행
- `jest.config.cjs` 사용 (`"type": "module"` 때문에 `.ts` 불가)
- `@octokit`은 ESM이라 `transformIgnorePatterns`에서 별도 처리

## GitHub Actions

- `test.yml` — PR 시 unit 테스트 (develop/main 대상)
- `deploy.yml` — develop 푸시 시 SSH 자동 배포 (`git checkout -- .` → pull → npm install → prisma generate → migrate deploy → **npm run build** → pm2 restart)
- `sync.yml` — `workflow_dispatch` 수동 트리거 전용 (cron 없음)
  - Secrets 필요: `SYNC_URL` (서버 URL), `ADMIN_SECRET`
- `blog-check.yml` — 매시간 cron `POST /admin/blog/sync` 호출 (GitHub API 미사용, RSS only)

## PR/브랜치 규칙

```
feat/#이슈번호-설명 → develop PR → 머지
```

- **PR은 기능 완성 시에만** (중간 커밋 PR 금지)
- 커밋 메시지: Conventional Commits, subject 소문자
- PR 시 Gemini Code Assist 자동 리뷰

## 환경변수 (.env)

```
DATABASE_URL=file:./prisma/dev.db
GITHUB_TOKEN=...
ADMIN_SECRET=...
```

## 예정 작업

없음
