# be-admin — 어드민 API·UI

---

## 2026-10-19

**어드민 SPA 구조 정리 (ARCHITECTURE_PLAN D-1b·D-2·D-3, 화면·동작 변화 없음)**

- **폴더**: `pages/<탭>Tab.tsx`(조립만) + `pages/<탭>/`(그 탭 전용 훅·컴포넌트: `member`·`sync`·`repo`·`archive`) → `components`(공용: `Layout`, `StreamLogConsole` 등)·`components/ui`(기본 부품) → `hooks` → `lib`(API·쿼리 키·유틸)
- **기본 부품** (`components/ui`, cva): `Table`·`Th`·`Td`, `Button`, `Badge`, `TextInput`·`Select`·`FieldLabel`, `SectionTitle`·`Panel`·`EmptyState`, `Modal`, `Toast`. 원래 손으로 쓴 클래스와 같은지 단위 테스트로 고정
- **색**: 원시 팔레트(`text-gray-500`) 대신 역할별 계열(`text-base-500`, `bg-primary-600`, `bg-danger-50` …), `index.css` `@theme`에 정의. `npm --prefix src/public/admin-spa run lint:tokens`가 CI에서 막는다
- **공통 훅**: `useEventStreamLog`(SSE 진행 로그, 싱크·아카이브 탭), `useSortableData`
- **규칙** (`.dependency-cruiser.cjs`, 위반 시 CI 실패): 순환 금지, 안 쓰는 모듈 금지, `lib`은 화면을 모름, `ui`는 다른 화면 코드에 기대지 않음, 공용은 페이지를 모름, 탭 폴더끼리 참조 금지
- **내보내기**: 탭 화면(`pages/*Tab.tsx`)만 `export default`(지연 로딩), 나머지는 이름 있는 내보내기
- **동작 고정 테스트**: `MemberTable.test.tsx`, `SyncTab.flow.test.tsx`, `ArchiveTab.flow.test.tsx`, `RepoTab.flow.test.tsx`. 분리 전 코드와 분리 후 코드에서 똑같이 통과하는 것을 확인

---

## 2026-04-23

**싱크 작업 큐 UI + 레포 일괄 트랙 변경 + 멤버 기수 재계산**

- **왜**: 동시 싱크 방지, 잘못된 기수 태그 수정, 레포 트랙 일괄 변경 필요
- **싱크탭** (`SyncTab.tsx`):
  - 작업 큐 테이블: POST /admin/sync/jobs로 큐 추가, 3초 폴링 상태 갱신
  - SSE `/admin/sync/jobs/:id/stream`으로 진행률 실시간 표시
  - 취소 버튼 (queued/running 상태)
- **레포탭** (`RepoTab.tsx`):
  - 체크박스 선택 → 일괄 트랙 변경
  - `lastSyncAt` 초기화 버튼 (해당 레포 전체 재수집)
- **멤버탭** (`MemberTable.tsx`):
  - `⚡` 기수 재계산 버튼: submissions 기준으로 기수 재계산

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

| 탭     | 파일                    | 주요 기능                                                           |
| ------ | ----------------------- | ------------------------------------------------------------------- |
| 멤버   | `pages/MemberTab.tsx`   | 필터/정렬/검색, 추가/삭제/새로고침, 블로그 포스트 모달, 기수 재계산 |
| 싱크   | `pages/SyncTab.tsx`     | 작업 큐, SSE 스트리밍 로그, 전체/기수/연속 싱크                     |
| 레포   | `pages/RepoTab.tsx`     | 상태 필터, 일괄 트랙 변경, lastSyncAt 초기화, 싱크                  |
| 블로그 | `pages/BlogTab.tsx`     | RSS 싱크, GitHub 블로그 백필, 최근 글 조회                          |
| 설정   | `pages/SettingsTab.tsx` | 워크스페이스, 금지어, 무시 도메인 관리                              |

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
