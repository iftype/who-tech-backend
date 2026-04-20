# API.md — Backend API 엔드포인트

모든 `/admin` 엔드포인트는 `Authorization: Bearer <ADMIN_SECRET>` 필요.

어드민 UI: `GET /admin/ui/admin.html` — 정적 JS는 `admin/` 디렉터리 ES 모듈(`main.js` 엔트리, `window`에 핸들러 노출으로 기존 `onclick` 유지)

## 어드민 API

### 수집 현황 / 워크스페이스

```
GET  /admin/status                    — 수집 현황 (memberCount, lastSyncAt)
GET  /admin/workspace                 — workspace 설정 조회
PUT  /admin/workspace                 — cohortRules, blogSyncEnabled 수정
```

### 미션 레포

```
GET  /admin/repos                     — 미션 레포 목록 (?status=)
POST /admin/repos                     — 레포 추가 (name, repoUrl, track, type?, syncMode?, cohorts?, level?)
POST /admin/repos/discover            — 조직 공개 레포 탐색 → once candidate 갱신 (precourse 제외)
PATCH /admin/repos/:id                — track, status, syncMode, cohorts, level 등 수정
DELETE /admin/repos                   — 전체 레포 + 관련 submission 삭제
DELETE /admin/repos/:id               — 레포 + 관련 submission 트랜잭션 삭제
POST /admin/repos/:id/sync            — 단건 레포 sync
```

### Sync

```
POST /admin/sync                      — once+미수집 레포만 대상으로 전체 sync (?cohort= 기수 필터)
GET  /admin/sync/stream               — sync 진행 SSE (?token= 인증, ?cohort= 기수 필터, progress/done/error 이벤트)
POST /admin/sync/cohort-repos         — CohortRepo에 등록된 레포만 전체 재sync (body: {cohort})
GET  /admin/sync/cohort-repos/stream  — 기수 목록 전체 재sync SSE (?token= 인증, ?cohort= 필수)
```

### 기수별 레포

```
GET  /admin/cohort-repos              — 기수별 레포 목록 (?cohort= 필수)
GET  /admin/cohort-repos/cohorts      — CohortRepo에 등록된 기수 목록
POST /admin/cohort-repos              — 기수 레포 추가 (cohort, missionRepoId, order?)
POST /admin/cohort-repos/auto-fill    — active 레포 cohorts 필드 기반 자동 채우기 (?cohort= 필수)
PATCH /admin/cohort-repos/:id         — order 수정
DELETE /admin/cohort-repos/:id        — 기수 레포 삭제
```

### 멤버

```
GET  /admin/members                   — 멤버 목록 (?q=&cohort=&hasBlog=&track=&role=)
POST /admin/members                   — 멤버 수동 생성 (githubId, nickname?, cohort?, roles?, blog?)
GET  /admin/members/:id/blog-posts    — 블로그 글 목록 (archive 30일 + latest 7일)
PATCH /admin/members/:id              — manualNickname, blog, roles 수정
DELETE /admin/members                 — 전체 멤버 + submissions + blogPosts 삭제
DELETE /admin/members/:id             — 멤버 + submissions + blogPosts 삭제
```

### 블로그

```
POST /admin/blog/sync                 — 블로그 RSS 전체 sync (blogSyncEnabled 체크)
POST /admin/blog/backfill             — GitHub profile blog 백필 (?limit=30&cohort= 기수 필터)
GET  /admin/blog/new-posts            — 최근 수집된 새 블로그 글 (?sinceMinutes=65)
```

### 로그

```
GET  /admin/logs                      — 어드민 활동 로그 조회 (최근 200개)
POST /admin/logs                      — 로그 기록 (type, message)
DELETE /admin/logs                    — 전체 로그 삭제
```

### Person (멤버 마스터)

```
GET  /admin/persons                   — Person 마스터 목록 (연결된 멤버 포함)
POST /admin/persons                   — Person 생성 (displayName?, note?, memberIds?)
PATCH /admin/persons/:id              — displayName, note 수정
DELETE /admin/persons/:id             — Person 삭제 (멤버 personId 자동 해제)
POST /admin/persons/:id/members/:memberId   — 멤버 → Person 연결
DELETE /admin/persons/:id/members/:memberId — 연결 해제
```

### 금지어 / 무시 도메인

```
GET  /admin/banned-words              — 금지어 목록
POST /admin/banned-words              — 금지어 추가 (body: {word})
DELETE /admin/banned-words/:id        — 금지어 삭제
GET  /admin/ignored-domains           — 무시 도메인 목록
POST /admin/ignored-domains           — 도메인 추가 (body: {domain})
DELETE /admin/ignored-domains/:id     — 도메인 삭제
```

### 기타

```
GET  /admin/archive                   — 기수별 아카이브 마크다운 (?cohort= 필수, ?track= 선택, ?format=md 텍스트 응답)
```

### 중복 생성 정책

- 동일 금지어 추가 → `409 word already exists`
- 동일 기수 레포 추가 → `409 cohort repo already exists`

## 공개 API (인증 불필요)

```
GET  /members                     — 멤버 검색 (?q=&cohort=&track=&role=)
GET  /members/feed                — 최근 블로그 피드 (?cohort=&track=)
GET  /members/:githubId           — 멤버 상세
```

- `submissions` 응답: `[{ prUrl, prNumber, title, submittedAt, missionRepo: { name, track, level, tabCategory } }]`
- `blogPosts` 응답: `BlogPostLatest` 최근 10개 (7일 스냅샷 기준)
