# be-sync — PR 수집·블로그 RSS·닉네임 파싱

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
