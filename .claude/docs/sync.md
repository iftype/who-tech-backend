# be-sync — PR 수집·블로그 RSS·닉네임 파싱

---

## 2026-10-20

**PR 처리 단위·레이트리밋·닉네임 통계 (리팩토링 라운드 2, #203 · #205 · #206 · #209 · #210 · #211)**

- **레포 싱크 작업**: 레포 탭의 싱크 작업 조회가 아무도 채우지 않는 저장소를 읽어 항상 404 → 싱크 큐에서 읽는다. 큐의 작업 종류 분기는 handler map
- **PR 처리 단위**: 슬림 select + PR마다 `$transaction` 하나(`sync-write.repository`). 기수·역할 id는 싱크 동안 캐시(커밋 후). PR 5건 쿼리 153 → 64
- **증분 싱크**: `maxPages: 1`(100건)이라 한 창에 100건 넘게 바뀌면 놓쳤다 → 오래된 PR을 만날 때까지 최대 10페이지 (아래 2026-04-09 결정을 바꿈)
- **레이트리밋**: 항상 재시도 → 2회·60초 이내만. 아니면 그 레포 실패로 기록하고 다음으로
- **취소**: `CancelledError`(문자열 비교 제거), 모든 반복문이 취소를 즉시 다시 던진다
- **닉네임 통계**: PR마다 +1(재처리 시 부풀음) → 모든 제출 제목으로 다시 계산(멱등), 동률이면 현재 닉네임 유지. 운영 복사본에서 표시 닉네임 변경 0
- **블로그**: 글이 하나도 없는 피드면 최근 90일 글을 지우지 않는다. RSS 요청은 리다이렉트마다 공개 호스트인지 다시 검사(SSRF)

---

## 2026-04-23

**싱크 작업 큐 및 기수 재계산**

- **왜**: 여러 싱크 동시 실행 시 GitHub API 요청 폭증. 프리코스 레포 싱크 후 삭제 시 잘못된 기수 태그 잔존.
- **핵심 파일**: `src/features/sync/sync.queue.ts`, `src/features/member/member.service.ts`
- **결정**:
  - `SyncQueue`: in-memory job queue, 레인(github·blog)마다 순차 처리, 취소 가능
  - `POST /admin/sync/jobs`, `GET /admin/sync/jobs`, `DELETE /admin/sync/jobs/:id`, `GET /admin/sync/jobs/:id/stream`
  - `AbortSignal` 전달: 취소 시 GitHub API fetch 즉시 중단
  - `recalculateMemberCohorts`: submissions 기준으로 기수 재계산, 불필요한 기수 자동 삭제
  - 전체 싱크 시 `sort: 'created', direction: 'asc'` → 오래된 PR부터 수집

---

## 2026-04-09

**PR 수집 로직 개선 (수정일 기준 + 100개 제한)**

- **왜**: 생성일 기준 수집 시 기존 PR의 상태 변경(open → merged)이 반영되지 않음. 대량 수집 시 효율성 저하.
- **핵심 파일**: `src/infra/github/github.client.ts`, `src/features/sync/sync.service.ts`
- **결정**:
  - `fetchRepoPRs`: `sort: 'updated'`로 변경, `updated_at` 기준으로 `since` 필터링.
  - `maxPages: 1` 강제: 매 수집 시 최근 100개만 확인하여 Rate Limit 방지 및 성능 최적화.

---

## 2026-04-02

**Brunch RSS 지원**

- `https://brunch.co.kr/@username` → `https://brunch.co.kr/rss/@username` 자동 변환
- **핵심 파일**: `src/features/blog/blog.service.ts` (`resolveRSSUrlsForBlog`)

---

## 2026-04-01

**ghost(탈퇴자) PR 처리**

- **왜**: `user.login === 'ghost'`인 PR 파싱 시 오류 발생
- **결정**: `parsePRsToSubmissions`에서 ghost PR 건너뜀, profile fetch 시 githubId가 'ghost'이면 기존 값 유지

---

## 2026-03-31

**닉네임 추출 토큰 기반으로 전환 (전면 개편)**

- **왜**: 레포마다 정규식을 관리해야 해서 유지보수 어려움
- **핵심 파일**: `src/shared/nickname.ts`
- **결정**:
  - `extractNicknameTokens(title)` — `[^가-힣]+`으로 분리, 한글 토큰만 추출
  - 각 토큰을 `mergeNicknameStat`으로 누적 → `nicknameStats` 상위 빈도가 닉네임 후보
  - `NicknameBannedWord` DB 필터링
  - `isValidNickname`: 길이(20자)만 검증, 단계명 체크 제거
- **제거**: `Workspace.nicknameRegex`, `MissionRepo.nicknameRegex`, `MissionRepo.cohortRegexRules`
- **제거된 엔드포인트**: `/admin/repos/detect-regex-all`, `/admin/repos/:id/detect-regex`, `/admin/repos/:id/validate-regex`

**무시 도메인 DB 관리**

- **이전**: `blog.ts`에 하드코딩된 배열
- **결정**: `IgnoredDomain` 테이블 + 하드코딩 fallback 유지
- `normalizeBlogUrl(url, ignoredDomains?)` 시그니처 추가

---

## 2026-03-29

**닉네임 정규화 버그 수정**

- **왜**: `[^가-힣]` 제거로 영문 닉네임·하이픈 포함 닉네임이 빈 문자열이 됨
- **핵심 파일**: `src/shared/nickname.ts`
- **결정**: 괄호/대괄호·끝 문장부호 처리 후 한글·영문·숫자·하이픈·쉼표·공백만 허용

---

## 2026-03-27

**syncWorkspace 방향 전환**

- **이전**: 동적 org 탐색 (GitHub API로 조직 레포 전체 조회)
- **결정**: DB 등록 레포만 수집 (탐색 없음), 레포는 어드민에서 `discover` 후 활성화

**inferTrack 재작성**

- 언어 prefix 기반: `javascript-*` → frontend, `java-*` → backend, `android-*` → android, prefix 없음 → null(공통)

**블로그 RSS 수집**

- Tistory 406: User-Agent, Accept 헤더 추가
- Velog `/posts`, Medium feed 경로, short link 해제, GitHub Pages `atom.xml`/`index.xml` 후보 추가

---

## 2026-03-26

**PR 수집 v1**

- `fetchRepoPRs` — GitHub API 전체 페이지네이션
- `parsePRsToSubmissions` — 토큰 추출 → DB upsert
- PR 상태: `open`, `merged`, `closed` 모두 저장
- 기수 판별: `created_at` 연도 → `cohortRules` JSON 매핑
