# Ignored-Domain Module (`src/features/ignored-domain/`)

> 무시할 블로그 도메인 관리. 백필 시 해당 도메인은 RSS 후보에서 제외.

## 파일 구조

| 파일                      | 라인 | 책임                   |
| ------------------------- | ---- | ---------------------- |
| `ignored-domain.route.ts` | 45   | 도메인 CRUD 엔드포인트 |

## 주요 함수

```typescript
createIgnoredDomainRouter({ ignoredDomainRepo, workspaceService }): Router
```

라우터가 직접 repository를 주입받아 service 레이어 없이 동작.

| 엔드포인트                          | 설명             |
| ----------------------------------- | ---------------- |
| GET `/admin/ignored-domains`        | 무시 도메인 목록 |
| POST `/admin/ignored-domains`       | { domain } 생성  |
| DELETE `/admin/ignored-domains/:id` | 삭제             |

## 의존성

- `IgnoredDomainRepository` — DB 접근 (findAll, create, delete)
- `WorkspaceService` — workspace id 조회

## 사용 위치

- `src/features/blog/blog.backfill.ts`의 `fetchUserBlogCandidates` 또는 관련 유틸에서 도메인 필터링에 참조.
