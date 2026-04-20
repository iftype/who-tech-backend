# Agent Protocol

## 완료 기준 (단축 금지)

```
소스 수정 → /typecheck → /test unit → 둘 다 통과 → 완료 선언
```

## 작업별 커맨드 규칙

| 작업               | 실행                                  |
| ------------------ | ------------------------------------- |
| 소스 `.ts` 수정 후 | `/typecheck` → `/test unit`           |
| 테스트 파일만 수정 | `/test unit`                          |
| DB 스키마 변경     | `/migrate` → `/typecheck`             |
| PR 전              | `/lint` → `/typecheck` → `/test unit` |

## 커맨드 정의 (`.claude/commands/`)

| 커맨드                             | 실행 내용                                          |
| ---------------------------------- | -------------------------------------------------- |
| `/typecheck`                       | `npx tsc --noEmit --skipLibCheck`                  |
| `/test [unit\|int\|coverage\|all]` | 인자별 jest 실행                                   |
| `/lint`                            | `lint:fix` + `format`                              |
| `/migrate`                         | prisma status → 이름 확인 → migrate dev → generate |

## 아키텍처

```
app.ts (composition root)
  ├── create*Repository(db)   ← Prisma 접근은 여기만
  ├── create*Service(repos)   ← repository 주입
  └── create*Router(service)  ← service 주입
```

데이터 흐름: `MissionRepo → GitHub API → parsePRsToSubmissions → upsert Member/Submission`
