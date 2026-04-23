# Archive Module (`src/features/archive/`)

> 기수별 제출 현황을 마크다운 테이블로 생성. 아카이브 페이지에 표시될 데이터.

## 파일 구조

| 파일                 | 라인 | 책임               |
| -------------------- | ---- | ------------------ |
| `archive.service.ts` | 91   | 마크다운 생성 로직 |
| `archive.route.ts`   | 31   | REST 엔드포인트    |

## 주요 함수

```typescript
createArchiveService({ memberRepo, cohortRepoRepo, workspaceService }): ArchiveService
```

| 메서드                                   | 설명                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `generateCohortMarkdown(cohort, track?)` | 해당 기수(및 선택적 track)의 멤버 제출 현황을 markdown 테이블로 생성. 없으면 "등록된 레포가 없습니다." |

## 마크다운 생성 규칙

1. CohortRepo의 level별 그룹핑
2. 그룹 내 레포를 컬럼으로 하는 테이블 생성
3. 멤버는 닉네임 오름차순 정렬(한글 localeCompare)
4. 각 셀에는 해당 멤버의 가장 오래된(첫 번째) PR 링크 표시. 없으면 `-`

## API 엔드포인트

| 메서드 | 경로                                    | 설명                                                         |
| ------ | --------------------------------------- | ------------------------------------------------------------ |
| GET    | `/admin/archive?cohort=&track=&format=` | markdown 생성. format=md 또는 Accept: text/plain 시 raw text |

## 의존성

- `MemberRepository` — 기수+track 필터로 멤버 및 submissions 조회
- `CohortRepoRepository` — 기수별 등록된 레포 목록 조회
- `WorkspaceService` — workspace id 조회

## 주의사항

- Submission은 역순으로 순회해 가장 오래된 PR을 남김(덮어쓰기).
- track 파라미터가 없으면 전체 track 레포를 한 테이블에 통합.
