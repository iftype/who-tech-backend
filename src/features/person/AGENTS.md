# Person Module (`src/features/person/`)

> Person(마스터 신원) 관리. 여러 Member를 하나의 Person으로 묶어 동일인 구분.

## 파일 구조

| 파일              | 라인 | 책임                          |
| ----------------- | ---- | ----------------------------- |
| `person.route.ts` | 123  | Person CRUD, Member 연결/해제 |

## 주요 함수

```typescript
createPersonRouter({ personRepo, memberRepo, workspaceService }): Router
```

라우터가 직접 repository를 주입받아 service 레이어 없이 동작.

| 엔드포인트                                    | 설명                                              |
| --------------------------------------------- | ------------------------------------------------- |
| GET `/admin/persons`                          | 전체 Person 목록(연결된 members 포함)             |
| POST `/admin/persons`                         | Person 생성. 선택적으로 memberIds로 즉시 연결     |
| PATCH `/admin/persons/:id`                    | displayName, note 수정                            |
| DELETE `/admin/persons/:id`                   | Person 삭제. 연결된 멤버의 personId는 null로 해제 |
| POST `/admin/persons/:id/members/:memberId`   | 멤버를 Person에 연결                              |
| DELETE `/admin/persons/:id/members/:memberId` | 멤버 연결 해제                                    |

## 의존성

- `PersonRepository` — Person CRUD, Member link/unlink
- `MemberRepository` — 멤버 존재 여부 확인, 상세 조회
- `WorkspaceService` — workspace id 조회

## DB 관계

```
Person (1) ──── (N) Member
```

- Member.personId는 nullable. 연결 해제 시 null.
- Person 삭제 시 연결된 Member의 personId를 먼저 null로 업데이트 후 삭제.
