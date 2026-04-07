# be-admin — 어드민 API·UI

---

## 2026-04-01

**아카이브 API**

- `GET /admin/archive?cohort=N[&track=X][&format=md]`
- CohortRepo.order 기준 정렬, level별 그룹핑, 닉네임×레포 마크다운 표
- **핵심 파일**: `src/features/archive/archive.service.ts`, `src/features/archive/archive.route.ts`

**블로그 새 글 알림**

- `GET /admin/blog/new-posts?sinceMinutes=65` — `BlogPost.createdAt` 기준 최근 글 조회
- `blog-check.yml` — sync 후 새 글 조회 → Slack 웹훅 발송(옵션)
- **핵심 파일**: `src/db/repositories/blog-post.repository.ts`, `src/features/blog/blog.route.ts`

**닉네임 선택 모달**

- 멤버 행 닉네임 클릭 → `nicknameStats` 후보 목록, 클릭 시 `PATCH /admin/members/:id`
- 초기화 버튼(`manualNickname: null`)
- **핵심 파일**: `src/public/admin/members.js`

---

## 2026-03-31

**금지어·무시 도메인 관리 API 신규**

- `GET/POST/DELETE /admin/banned-words`
- `GET/POST/DELETE /admin/ignored-domains`
- **핵심 파일**: `src/features/banned-word/`, `src/features/ignored-domain/`

**어드민 UI 모듈 분리**

- `src/public/admin.js` 제거 → `src/public/admin/` ES 모듈
- 엔트리: `main.js` (`type="module"`), 기존 `onclick`은 `Object.assign(window, …)`으로 호환 유지
- 모듈: state, http, utils, auth, bootstrap, logs, workspace, repos, members, sync, blog, regex, cohort-repos
- repos ↔ cohort-repos 순환 참조: `changeCohortRepoLevel`에서만 `import('./cohort-repos.js')` 동적 로드

---

## 2026-03-28

**Activity Log 서버 DB 저장**

- **왜**: 새로고침 후 로그 유실
- **결정**: `ActivityLog` 테이블 신규, repo sync/blog sync 상세 실패 원인 기록

**멤버 역할 인라인 수정**

- Members 테이블에서 크루/코치/리뷰어 역할을 인라인 버튼으로 즉시 수정

**어드민 어드민 밀도 축소·모바일 대응**

---

## 2026-03-27

**레포 상태 필드 도입**

- `MissionRepo.status`: `active | candidate | excluded`
- `POST /admin/repos/discover` — woowacourse 조직 공개 레포 → 후보 분류
- 어드민 레포 테이블: 후보/활성/제외 상태 표시, 이름/상태/트랙 필터

**멤버 manualNickname·nicknameStats**

- `Member.manualNickname` — 수동 고정 닉네임
- `Member.nicknameStats` JSON — 파싱 닉네임 이력·빈도

**블로그 백필**

- `POST /admin/blog/backfill?limit=30` — blog 없는 멤버 GitHub profile에서 blog 추출
- **주의**: 최대 30명 단위 (GitHub API 사용량)

---

## 2026-03-26

**어드민 API v1**

- `GET/PUT /admin/workspace`, `GET /admin/status`, `POST /admin/sync`
- `GET/POST/PATCH/DELETE /admin/repos`
- `admin.html` — 비밀키 로그인, 수집 현황, 수동 sync, 레포 관리
