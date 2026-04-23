# Workspace Module (`src/features/workspace/`)

> Workspace 설정 관리. 단일 Workspace 행을 기준으로 cohortRules, blogSyncEnabled, profileRefreshEnabled 등을 CRUD.

## 파일 구조

| 파일                   | 라인 | 책임                                           |
| ---------------------- | ---- | ---------------------------------------------- |
| `workspace.service.ts` | 61   | 설정 조회/수정, sync context 제공              |
| `workspace.route.ts`   | 24   | `GET /admin/workspace`, `PUT /admin/workspace` |

## 주요 함수

```typescript
createWorkspaceService({ workspaceRepo }): WorkspaceService
```

| 메서드                  | 설명                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `getSettings()`         | cohortRules(JSON 파싱), blogSyncEnabled, profileRefreshEnabled 반환 |
| `updateSettings(input)` | 위 필드 선택적 업데이트, JSON stringify/parse 처리                  |
| `touchProfileRefresh()` | lastProfileRefreshAt 갱신                                           |
| `getSyncContext()`      | sync 모듈에 필요한 githubOrg + cohortRules 반환                     |

## API 엔드포인트

| 메서드 | 경로               | 설명                                                                  |
| ------ | ------------------ | --------------------------------------------------------------------- |
| GET    | `/admin/workspace` | 현재 Workspace 설정 조회                                              |
| PUT    | `/admin/workspace` | 설정 수정 (body: cohortRules, blogSyncEnabled, profileRefreshEnabled) |

## 의존성

- `WorkspaceRepository` — 단일 Workspace 행 접근 (findOrThrow, update)

## 주의사항

- cohortRules는 DB에 JSON string으로 저장. service 레이어에서 parse/stringify 담당.
- 항상 `WORKSPACE_NAME` 상수로 고정된 단일 Workspace를 조회. 다중 Workspace 미지원.
