# AGENTS.md — who-tech-backend

> Claude Code와 OpenCode 모두 이 파일을 참조합니다.
> 조걶 rules: `/test`, `/migrate` 커맨드는 `.claude/commands/` 참조

---

## 1. Agent Protocol

### 완료 기준 (단축 금지)

```
소스 수정 → /typecheck → /test unit → 둘 다 통과 → 완료 선언
```

### 작업별 커맨드 규칙

| 작업               | 실행                                  |
| ------------------ | ------------------------------------- |
| 소스 `.ts` 수정 후 | `/typecheck` → `/test unit`           |
| 테스트 파일만 수정 | `/test unit`                          |
| DB 스키마 변경     | `/migrate` → `/typecheck`             |
| PR 전              | `/lint` → `/typecheck` → `/test unit` |

### 커맨드 정의 (`.claude/commands/`)

| 커맨드                             | 실행 내용                                          |
| ---------------------------------- | -------------------------------------------------- |
| `/typecheck`                       | `npx tsc --noEmit --skipLibCheck`                  |
| `/test [unit\|int\|coverage\|all]` | 인자별 jest 실행                                   |
| `/lint`                            | `lint:fix` + `format`                              |
| `/migrate`                         | prisma status → 이름 확인 → migrate dev → generate |

### 아키텍처

```
app.ts (composition root)
  ├── create*Repository(db)   ← Prisma 접근은 여기만
  ├── create*Service(repos)   ← repository 주입
  └── create*Router(service)  ← service 주입
```

데이터 흐름: `MissionRepo → GitHub API → parsePRsToSubmissions → upsert Member/Submission`

---

## 2. 코드 컨벤션

### 필수 규칙

- **ESM only** — `import/export` 사용, `require` / `module.exports` 금지
- **TypeScript strict** — `any` 타입 금지, `unknown` + 타입가드로 대체
- **에러 타입 명시** — `catch (e)` 후 `instanceof Error` 체크 필수
- **Prisma는 repository만** — service에서 직접 `db.*` 호출 금지
- **`console.log` 커밋 금지**

### 커밋 규칙

```
feat / fix / refactor / test / chore
subject 소문자, 한국어 가능
예: feat: 멤버 역할 필터링 추가
```

### PR 규칙

- `feat/#이슈번호-설명` 브랜치 → main PR
- 기능 완성 시에만 PR (중간 커밋 PR 금지)

---

## 3. 배포 규칙

### 자동 배포 흐름

```
main push → deploy.yml → POST /admin/deploy 웹훅
→ git pull + npm install + prisma generate + migrate deploy + build + pm2 reload
```

### 수동 배포

```bash
ssh oracle "cd ~/app/who-tech-backend && git pull origin main && npm install --ignore-scripts && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 reload backend --update-env"
```

### GitHub Actions 워크플로우

| 파일                  | 트리거    | 역할                          |
| --------------------- | --------- | ----------------------------- |
| `deploy.yml`          | main push | 자동 배포                     |
| `continuous-sync.yml` | 10분 cron | `POST /admin/sync/continuous` |
| `blog-check.yml`      | 매시간    | `POST /admin/blog/sync`       |

### 주의

- `SYNC_URL` 시크릿 미설정 시 `https://iftype.store` fallback
- PM2 앱 이름: `backend`
- 자세한 내용: `.claude/docs/deploy.md`, `.claude/docs/infra.md`

### 버전 관리

- `src/public/admin-spa/package.json`의 `version`은 어드민 UI 우측 상단에 표시됨
- **main push 시 GitHub Actions가 patch 버전을 자동 증가** (`1.0.0` → `1.0.1` → `1.0.2` ...)
- 수동 증가: `npm run bump:admin-version`
- `[skip ci]` 태그로 무한 루프 방지

---

## 4. 테스트 컨벤션

### 파일 구조

```
src/__tests__/
├── unit/          ← 서비스·유틸 (DB 없음)
├── integration/   ← HTTP + 실제 SQLite
└── fixtures/      ← 공통 mock 데이터·팩토리
```

파일명: `{대상}.test.ts` (예: `sync.service.test.ts`)

### Mock 원칙

| 대상                 | Unit          | Integration   |
| -------------------- | ------------- | ------------- |
| Repository (Prisma)  | **항상 mock** | 실제 DB       |
| Octokit (GitHub API) | **항상 mock** | **항상 mock** |
| RSS fetcher          | **항상 mock** | **항상 mock** |

### 구조

```typescript
describe('SyncService', () => {
  describe('syncWorkspace', () => {
    it('should upsert members when PRs are found');
    it('should skip when no active repos exist');
  });
});
```

- 파일당 최상위 `describe` 1개
- `it`은 "should ~" 형식

### 커버리지

- lines / functions 60% 미달 → `npm run test:coverage` 실패
- 새 서비스 파일 추가 시 unit 테스트 파일 필수

---

## 5. Sync 모듈 (조걶: `src/features/sync/**`)

### 주요 진입점

| 함수                    | 역할                                   |
| ----------------------- | -------------------------------------- |
| `syncWorkspace`         | DB의 모든 active 레포 수집             |
| `syncContinuousRepos`   | syncMode=continuous 레포만 (10분 cron) |
| `fetchRepoPRs`          | GitHub API로 PR 목록 조회              |
| `parsePRsToSubmissions` | PR → Submission 변환                   |

### 핵심 로직

- PR 상태: open / merged / closed 모두 저장
- 닉네임 추출: `[^가-힣]+` 분리 → 한글 토큰 빈도 집계 (`nicknameStats`)
- 기수 판별: PR `created_at` 연도 → `cohortRules` JSON 매핑
- GitHub API 레이트리밋: `@octokit/plugin-throttling` 자동 처리

### 주의사항

- `syncMode=once` 레포는 초기 수집 후 재실행 안 함
- maxPages 설정으로 대형 레포 수집량 제한 (현재 30)
- 자세한 내용: `.claude/docs/sync.md`

---

## 6. DB 스키마 (조걶: `prisma/**`)

### 마이그레이션 워크플로우

`/migrate` 커맨드 사용 (직접 실행 금지):

1. `npx prisma migrate status` — 현재 상태 확인
2. 마이그레이션 이름 확인 후 `npx prisma migrate dev --name <name>`
3. `npx prisma generate` — client 재생성

### 핵심 모델 관계

```
Workspace (1) ──── (N) MissionRepo
MissionRepo (1) ── (N) CohortRepo
Member (N) ─────── (1) Person (선택)
Member (N) ─────── (N) Cohort (MemberCohort)
Member (1) ─────── (N) Submission
```

### 주요 모델 필드

- `MissionRepo`: track(frontend|backend|android|null), syncMode(continuous|once), status(active|candidate|excluded)
- `Member`: githubId, nicknameStats(JSON), rssStatus, personId(nullable)
- `Workspace`: githubOrg, cohortRules(JSON), blogSyncEnabled

### 주의

- SQLite 사용 중 — JSON 필드는 string으로 저장, 앱에서 파싱
- 자세한 스키마: `.claude/docs/ARCHITECTURE.md`
