# be-admin — 어드민 API·UI

---

## 2026-04-21

**어드민 React SPA 전면 교체 (Phase 0-6)**

- **왜**: 기존 vanilla JS 어드민(`src/public/admin.html`, `scipts/`)을 Vite + React + Tailwind 기반 SPA로 교체
- **진입점**: `GET /admin` → `/admin/ui/admin-dist/` 리다이렉트
- **SPA 위치**: `src/public/admin-spa/` (빌드 출력: `dist/public/admin-dist/`)
- **로컬 개발**: `cd src/public/admin-spa && npm run dev` (포트 5173, `/admin` → 3000 프록시)
- **빌드**: `npm run build:admin` or `npm run build` (전체 빌드에 포함)
- **인증**: localStorage Bearer token, `AuthContext` 관리
- **라우팅**: HashRouter (`/#/members`, `/#/sync`, `/#/repos`, `/#/blog`, `/#/settings`)

**구현된 탭**

| 탭     | 파일                    | 주요 기능                                              |
| ------ | ----------------------- | ------------------------------------------------------ |
| 멤버   | `pages/MemberTab.tsx`   | 필터/정렬/검색, 추가/삭제/새로고침, 블로그 포스트 모달 |
| 싱크   | `pages/SyncTab.tsx`     | SSE 스트리밍 로그, 전체/기수/연속 싱크, 레포 업데이트  |
| 레포   | `pages/RepoTab.tsx`     | 상태 필터, 상태 토글/단건 싱크/삭제, 레포 탐색         |
| 블로그 | `pages/BlogTab.tsx`     | RSS 싱크, GitHub 블로그 백필, 최근 글 조회             |
| 설정   | `pages/SettingsTab.tsx` | 워크스페이스, 금지어, 무시 도메인 관리                 |

**핵심 파일**

- `src/public/admin-spa/src/lib/api.ts` — Bearer 토큰 자동 주입 fetch 래퍼
- `src/public/admin-spa/src/lib/sse.ts` — `?token=` 쿼리 기반 EventSource
- `src/public/admin-spa/src/context/AuthContext.tsx` — 로그인/로그아웃 상태
- `src/app.ts` — `/admin/ui` 정적 서빙, `/admin` 리다이렉트, deploy 웹훅

---

## 2026-04-09

**수동 동기화 필터 완화**

- **왜**: `active` 상태인 레포지토리가 수동 동기화 대상에서 제외되어 즉시 갱신이 불가능함.
- **핵심 파일**: `src/features/sync/sync.service.ts`
- **결정**: `syncWorkspace` 필터에서 `syncMode === 'once'` 및 `lastSyncAt === null` 제약 제거 → 모든 `active` 레포 수집 가능.

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

---

## 2026-03-31

**금지어·무시 도메인 관리 API 신규**

- `GET/POST/DELETE /admin/banned-words`
- `GET/POST/DELETE /admin/ignored-domains`
- **핵심 파일**: `src/features/banned-word/`, `src/features/ignored-domain/`

---

## 2026-03-28

**Activity Log 서버 DB 저장**

- **왜**: 새로고침 후 로그 유실
- **결정**: `ActivityLog` 테이블 신규, repo sync/blog sync 상세 실패 원인 기록

---

## 2026-03-27

**레포 상태 필드 도입**

- `MissionRepo.status`: `active | candidate | excluded`
- `POST /admin/repos/discover` — woowacourse 조직 공개 레포 → 후보 분류

**블로그 백필**

- `POST /admin/blog/backfill?limit=30` — blog 없는 멤버 GitHub profile에서 blog 추출
- **주의**: 최대 30명 단위 (GitHub API 사용량)

---

## 2026-03-26

**어드민 API v1**

- `GET/PUT /admin/workspace`, `GET /admin/status`, `POST /admin/sync`
- `GET/POST/PATCH/DELETE /admin/repos`
