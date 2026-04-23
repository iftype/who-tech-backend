# Cohort-Repo Module (`src/features/cohort-repo/`)

> 기수별 MissionRepo 매핑 관리. 아카이브 markdown 생성에 사용될 레포 순서를 정의.

## 파일 구조

| 파일                     | 라인 | 책임                        |
| ------------------------ | ---- | --------------------------- |
| `cohort-repo.service.ts` | 83   | 기수별 레포 CRUD, auto-fill |
| `cohort-repo.route.ts`   | 69   | REST 엔드포인트             |

## 주요 함수

```typescript
createCohortRepoService({ cohortRepoRepo, missionRepoRepo, workspaceService }): CohortRepoService
```

| 메서드                  | 설명                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `listByCohort(cohort)`  | 해당 기수에 매핑된 레포 목록(order asc)                                                     |
| `listCohorts()`         | 등록된 기수 번호 목록(내림차순)                                                             |
| `create(input)`         | 기수-레포 매핑 생성. 중복 시 409                                                            |
| `update(id, { order })` | 순서 수정                                                                                   |
| `delete(id)`            | 매핑 삭제                                                                                   |
| `autoFill(cohort)`      | MissionRepo의 cohorts JSON에 해당 기수가 포함된 레포를 자동 등록. level asc → name asc 순서 |

## API 엔드포인트

| 메서드 | 경로                            | 설명                                          |
| ------ | ------------------------------- | --------------------------------------------- |
| GET    | `/admin/cohort-repos/cohorts`   | 기수 목록                                     |
| GET    | `/admin/cohort-repos?cohort=`   | 기수별 레포 목록                              |
| POST   | `/admin/cohort-repos/auto-fill` | { cohort } JSON으로 자동 채우기               |
| POST   | `/admin/cohort-repos`           | 매핑 생성 ({ cohort, missionRepoId, order? }) |
| PATCH  | `/admin/cohort-repos/:id`       | 순서 수정 ({ order })                         |
| DELETE | `/admin/cohort-repos/:id`       | 매핑 삭제                                     |

## 의존성

- `CohortRepoRepository` — 기수-레포 매핑 DB 접근
- `MissionRepoRepository` — active 레포 전체 조회 (auto-fill 시 사용)
- `WorkspaceService` — workspace id 조회

## 주요 비즈니스 규칙

- auto-fill은 MissionRepo.cohorts JSON 배열에 해당 기수가 포함된 레포만 대상.
- 이미 등록된 레포는 제외. 새 레포는 기존 마지막 order 다음부터 할당.
- 레포 정렬: level 오름차순, 같으면 name 오름차순.
