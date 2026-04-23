=== 마지막 세션: 2026-04-21 ===

### 완료 작업

✅ 개인 프로필 새로고침 fetchUserBlogCandidates + RSS 프로빙으로 변경 (blog 필드만 → bio/README/소셜 스캔)
✅ 개인 새로고침 GitHub API 실패 시 500 반환 (기존: 200 + profileRefreshError)
✅ .omc 디렉토리 git 추적 제거
✅ 어드민 SPA Phase 0 스캐폴드 (src/public/admin-spa/)
✅ GitHub 토큰 Classic PAT으로 교체 + pm2 env 반영

=== 다음 세션 작업 ===

## 1️⃣ 어드민 React SPA (최우선)

**플랜**: `.omc/plans/admin-react-spa.md`

- [x] Phase 0: Vite + React + Tailwind 스캐폴드
- [x] Phase 1: App Shell (Auth, Layout, 5탭 네비게이션)
- [x] Phase 2: 멤버 탭 (MemberTable, MemberFilters, MemberAddForm, Toast, Modal)
- [x] Phase 3: 싱크 탭 (SSE 스트리밍, 전체/기수/연속/레포 싱크)
- [x] Phase 4: 레포 탭 (목록/상태토글/싱크/삭제/탐색)
- [x] Phase 5: 블로그 탭 (RSS싱크/백필/최근글) + 설정 탭 (워크스페이스/금지어/무시도메인)
- [x] Phase 6: 마이그레이션 (admin.html/admin.css/scipts/ 삭제, /admin → /admin/ui/admin-dist/ 리다이렉트, deploy 명령 admin-spa npm install 추가)

**주의**: CI에 `cd src/public/admin-spa && npm install` 단계 추가 필요 (`.github/workflows/deploy.yml`)

## 2️⃣ 전체 서버 코드 리팩토링

- [x] blog.service.ts (309→107): blog.rss.ts 분리
- [x] member.service.ts (365→218): member.response.ts, member.profile-refresh.ts 분리
- [x] sync.service.ts (436→394): sync.pr-parser.ts 분리
- [ ] sync.service.ts (394줄) 추가 분리 여지 있음 (resolveProfile, upsertMemberAndSubmission)
- [ ] blog.admin.service.ts (279줄), repo.service.ts (256줄) 분리 검토
- [ ] 하네스 문서(.claude/rules/, .claude/docs/) 업데이트

## 3️⃣ 어드민 React SPA — 누락 기능 / 버그 (2026-04-22 분석)

> 분석 결과: 마이그레이션된 React 어드민이 DB 스키마/백엔드 API와 심각하게 불일치

### 🔴 P0 — 버그 (필수 수정) ✅ 완료

- [x] **RepoTab `status` 필터 오류**: UI에 `active | inactive | once` 있으나 DB 실제 값은 `active | candidate | excluded`. `inactive`와 `once`는 존재하지 않는 값. `candidate`/`excluded` 필터 불가
  - 파일: `src/public/admin-spa/src/pages/RepoTab.tsx` line 7
- [x] **RepoTab `tabCategory` 완전 누락**: DB `MissionRepo.tabCategory` = `base | common | precourse | excluded`. 기준/공통/프리코스/제외 레포 구분 UI 없음
- [x] **RepoTab `type` 필드 누락**: DB `MissionRepo.type` = `individual | integration`. 개인/통합 미션 구분 UI 없음
- [x] **RepoTab `toggleStatus()` 로직 오류**: `active ↔ inactive` 토글. DB에는 `inactive` 없음. `candidate` → `active` 승인 플로우 없음

### 🟡 P1 — 기능 누락 ✅ 완료

- [x] **PR 확인 탭**: `Submission` 모델(`prUrl/prNumber/status/submittedAt`) 있는데 UI 전혀 없음. 멤버별/레포별 PR 조회 필요
  - 파일: `src/public/admin-spa/src/pages/PRTab.tsx` (신규)
  - 백엔드: `src/features/member/member.route.ts`에 GET `/admin/members/:id` 추가
- [x] **싱크 스케줄 설정/확인 UI**: `syncMode=continuous` 레포 자동 싱크, `scheduler` 블로그 싱크 상태 확인 불가. "시간마다 돌고 있는지" 확인할 화면 없음
  - 파일: `src/public/admin-spa/src/pages/SyncTab.tsx` — 연속 싱크 대상 레포 목록 + blogSyncEnabled 상태 표시

### 남은 P1

- [x] **candidate 레포 승인 플로우**: `discover`로 발견된 후보(`candidate`)를 `active`로 승인하는 UI
  - RepoTab 액션 컬럼에 candidate 상태일 때 ✓ 버튼 추가
- [ ] **싱크 작업 히스토리**: `/admin/repos/sync-jobs/:jobId` API 존재하나 작업 목록/히스토리 API 없음. 백엔드 추가 필요

### 🟢 P2 — 부가 탭 (API 존재, UI 없음) ✅ 완료

- [x] **아카이브 탭**: `/admin/archive?cohort=N` — 기수별 아카이브 마크다운
  - 파일: `src/public/admin-spa/src/pages/ArchiveTab.tsx` (신규)
- [x] **Person 관리 탭**: `/admin/persons` — 멤버 마스터 그룹핑
  - 파일: `src/public/admin-spa/src/pages/PersonTab.tsx` (신규)
- [x] **활동 로그 뷰어**: `/admin/logs` — 서버 저장된 어드민 활동 로그
  - 파일: `src/public/admin-spa/src/pages/LogTab.tsx` (신규)

### 성능 개선 (부분 완료)

- [x] 아바타 이미지 lazy loading 추가 (MemberTable, PRTab)
- [x] useMembers staleTime 30초 → 60초
- [ ] 멤버/레포 테이블 가상화(virtualization) — 대용량 시 필요, react-window 등 도입 검토
- [ ] 탭 전환 시 전체 데이터 refetch 최소화 — React Query gcTime 조정 검토

---

## 4️⃣ Dependabot 취약점 패치

- 현재 2개 high severity (GitHub Security tab 참고)

---

## 5️⃣ 프로필 새로고침 시스템 재설계 + AGENTS.md 문서화 (BETA 1.0.1)

> 분석 완료: 2026-04-23

### 배경

- 현재 매시간 GitHub Actions cron으로 전체 멤버 프로필 새로고침 (비효율적)
- 변경 없어도 GitHub API + RSS Probe 호출
- 클라이언트에서 개별 멤버 새로고침 불가
- ActivityLog 7일/200개 제한 — 추적 용도 부족
- Cohort 판별이 날짜 기반 (연도→기수) — 부정확

### 목표

- 클라이언트(Next.js)에서 개별 멤버 새로고침 버튼 제공
- Rate limiting: 개별 1분, 전체 1일 (admin만)
- ActivityLog 확장: source/memberGithubId/metadata 필드, 월별 보존
- Cohort 빈도수 기반 판별 (nicknameStats와 동일 방식)
- 각 폴더별 AGENTS.md 작성

### 설계 결정

- **로그 보존**: 3개월 롤링, 최대 제한 없음 (SQLite 용량 허용)
- **멤버별 요청 추적**: memberGithubId 인덱스 + countByMember 쿼리
- **기존 인원 처리**: 점진적 적용 (새로고침 시 → 배치 스크립트 → 자동)
- **PR 4개 이하**: minSubmissions=3, minDominance=0.5, 동률 시 최신 기수 우선
- **전체 새로고침**: 클라이언트에서 제거, GitHub Actions cron만 유지 (6시간)

### TODO

- [x] Phase 0: AGENTS.md 작성 (각 폴더별) — 12개 파일 완료
- [x] Phase 1: DB 스키마 변경 (ActivityLog 확장) — source, memberGithubId, metadata 필드 + 인덱스 4개
- [x] Phase 2: ActivityLog 확장 + Rate Limiting 로직 — repository 3개 메서드 추가, service에 checkRateLimit/getLogsByType 추가
- [x] Phase 3: 퍼블릭 엔드포인트 (개별 새로고침) — POST /members/:githubId/refresh, 1분 rate limit, 429 응답
- [x] Phase 4: Cohort 빈도수 기반 개선 + console.log 제거 — minSubmissions=3, minDominance=0.5 적용, console.log/console.error 제거
- [x] Phase 5: 프론트엔드 새로고침 버튼 ([githubId] 페이지) — RefreshButton 컴포넌트, api.members.refresh, 429 처리, 카운트다운
- [x] Phase 6: GitHub Actions cron 조정 (매시간 → 6시간) — member-refresh.yml cron '0 _/6 _ \* \*'

---

## 서버 운영 메모

- GitHub Token: Classic PAT (`public_repo` + `read:user`), `.env`에 저장
- pm2 env 업데이트: `set -a && . .env && set +a && pm2 restart backend --update-env`
- blog 수집 24h 게이트: sync에서 profileFetchedAt 기준, 즉시 반영은 개인 새로고침 사용
- admin-spa 로컬 개발: `cd src/public/admin-spa && npm install && npm run dev` (포트 5173, /admin 프록시→3000)
