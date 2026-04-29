# Blog Module (`src/features/blog/`)

> 블로그 RSS 수집, 동기화, 백필, 최신 글 조회. 90일치 데이터를 유지하고 7일/30일 필터로 노출. 멤버당 최대 100개 저장.

## 파일 구조

| 파일                    | 라인 | 책임                                                                      |
| ----------------------- | ---- | ------------------------------------------------------------------------- |
| `blog.service.ts`       | 147  | RSS 기반 블로그 동기화 핵심 로직. 90일 저장/100개 롤오버/멤버별 병렬 정리 |
| `blog.admin.service.ts` | 192  | job 큐잉, 자동/수동 sync 조율, 활동 로그 기록                             |
| `blog.rss.ts`           | 177  | RSS fetch, URL 후보 생성, velog/tistory/medium 특화 처리                  |
| `blog.backfill.ts`      | 91   | GitHub 프로필에서 블로그 후보를 추출해 RSS 검증 후 자동 등록              |
| `blog.route.ts`         | 71   | sync, backfill, new-posts 엔드포인트                                      |

## 주요 함수

```typescript
createBlogService({ memberRepo, blogPostRepo }): BlogService
createBlogAdminService({ memberRepo, blogPostRepo, workspaceService, blogService, activityLogService, octokit }): BlogAdminService
```

| 메서드                                       | 파일    | 설명                                                                   |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `syncBlogs(workspaceId, onProgress?)`        | service | 모든 멤버 RSS 수집. 30일 기준 upsert/delete. 실패 목록 반환            |
| `enqueueWorkspaceBlogSync(source)`           | admin   | 비동기 job 등록. 중복 실행 방지. 6시간 후 클린업                       |
| `getNewPosts(sinceMinutes)`                  | admin   | 최근 N분 내 생성된 블로그 글 목록                                      |
| `backfillWorkspaceBlogLinks(limit, cohort?)` | admin   | blog 없는 멤버 대상 GitHub 프로필 → RSS probe → 자동 등록              |
| `fetchRSSItems(blogUrl)`                     | rss     | URL 단축 해제 → RSS 후보 순회 → 파싱. velog/tistory/medium/brunch 특화 |
| `resolveRSSUrlsForBlog(blogUrl)`             | rss     | 플랫폼별 RSS URL 후보 생성                                             |

## API 엔드포인트

| 메서드 | 경로                                  | 설명                              |
| ------ | ------------------------------------- | --------------------------------- |
| POST   | `/admin/blog/sync`                    | 블로그 동기화 시작 (202 Accepted) |
| GET    | `/admin/blog/sync-jobs`               | sync job 목록                     |
| GET    | `/admin/blog/sync-jobs/:jobId`        | 특정 job 상태 조회                |
| GET    | `/admin/blog/new-posts?sinceMinutes=` | 최근 새 글 조회 (기본 65분)       |
| POST   | `/admin/blog/backfill?limit=&cohort=` | 블로그 링크 백필                  |

## 의존성

- `MemberRepository`, `BlogPostRepository` — DB 접근
- `WorkspaceService` — workspace 설정, id 조회
- `ActivityLogService` — 자동 sync 결과 로깅
- `Octokit` — backfill 시 GitHub 프로필 조회

## 주요 비즈니스 규칙

- 저장 기한 90일 (`RETENTION_DAYS = 90`). 조회 기한 7일/30일 (`days` 파라미터).
- 멤버당 최대 저장 100개 (`MAX_POSTS_PER_MEMBER = 100`). 초과 시 오래된 글부터 삭제.
- RSS URL이 변경되면 기존 글 전체 삭제 후 재수집.
- 피드에서 사라진 글은 90일 이내 데이터만 삭제 대상.
- sync 완료 후 멤버별 초과분 병렬 삭제 (`Promise.all`).
