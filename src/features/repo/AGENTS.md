# Repo Module (`src/features/repo/`)

> MissionRepo CRUD, GitHub 조직 레포 발견, 개별/전체 sync job 관리.

## 파일 구조

| 파일                        | 라인 | 책임                                        |
| --------------------------- | ---- | ------------------------------------------- |
| `repo.service.ts`           | 261  | 레포 CRUD, sync job 큐잉, 후보 refresh      |
| `repo-discovery.service.ts` | 171  | GitHub org 레포 목록 조회 및 미션 레포 분류 |
| `repo.route.ts`             | 88   | REST 엔드포인트                             |

## 주요 함수

```typescript
createRepoService({ missionRepoRepo, workspaceService, syncService, octokit }): RepoService
```

| 메서드                               | 설명                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `listRepos(status?)`                 | status 필터로 레포 목록 조회. cohorts JSON 파싱 포함                                                 |
| `createRepo(input)`                  | 수동 레포 생성. 기본값: type=individual, tabCategory=base/common, status=active, syncMode=continuous |
| `updateRepoMatchingRules(id, input)` | 레포 속성 선택적 수정                                                                                |
| `enqueueRepoSyncById(id)`            | 단일 레포 sync job 등록. 전체 PR 재수집(lastSyncAt=null)                                             |
| `refreshRepoCandidates()`            | GitHub org의 public 레포를 스캔해 candidate/excluded 자동 분류 및 upsert                             |
| `resetRepoSyncStatus(id)`            | lastSyncAt을 null로 설정해 다음 sync 시 전체 재수집                                                  |
| `deleteRepo(id)`                     | 레포 및 연결된 Submission 삭제                                                                       |
| `deleteAllRepos()`                   | 워크스페이스 전체 레포 및 Submission 삭제                                                            |

## API 엔드포인트

| 메서드 | 경로                            | 설명                                 |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/admin/repos?status=`          | 레포 목록                            |
| POST   | `/admin/repos/discover`         | GitHub org 스캔 후 candidate refresh |
| POST   | `/admin/repos`                  | 레포 생성                            |
| PATCH  | `/admin/repos/:id`              | 레포 수정                            |
| POST   | `/admin/repos/:id/sync`         | 단일 레포 sync 시작                  |
| POST   | `/admin/repos/:id/reset-sync`   | sync 상태 초기화                     |
| GET    | `/admin/repos/sync-jobs`        | sync job 목록                        |
| GET    | `/admin/repos/sync-jobs/:jobId` | job 상태 조회                        |
| DELETE | `/admin/repos/:id`              | 레포 삭제                            |
| DELETE | `/admin/repos`                  | 전체 레포 삭제                       |

## 의존성

- `MissionRepoRepository` — 레포 DB 접근
- `WorkspaceService` — githubOrg, sync context 조회
- `SyncService` — `syncRepo()` 호출로 실제 PR 수집
- `Octokit` — GitHub org 레포 목록 조회

## 주요 비즈니스 규칙

- 레포 발견 규칙: `javascript-|react-|java-|spring-|android-|kotlin-|compose-|jwp-|ts-` 접두사 또는 mission 관련 키워드 포함. docs/roadmap/wiki 등은 excluded.
- track 추론: 접두사 → frontend/backend/android. 없으면 language 보조 판단.
- 수동 sync는 전체 PR 재수집(once 모드와 동일 동작).
