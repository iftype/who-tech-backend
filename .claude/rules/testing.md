---
paths:
  - 'src/__tests__/**'
  - 'jest.config*'
---

# 테스트 컨벤션

## 파일 구조

```
src/__tests__/
├── unit/          ← 서비스·유틸 (DB 없음)
├── integration/   ← HTTP + 실제 SQLite
└── fixtures/      ← 공통 mock 데이터·팩토리
```

파일명: `{대상}.test.ts` (예: `sync.service.test.ts`)

## Mock 원칙

| 대상                 | Unit          | Integration   |
| -------------------- | ------------- | ------------- |
| Repository (Prisma)  | **항상 mock** | 실제 DB       |
| Octokit (GitHub API) | **항상 mock** | **항상 mock** |
| RSS fetcher          | **항상 mock** | **항상 mock** |

## 구조

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

## 커버리지

- lines / functions 60% 미달 → `npm run test:coverage` 실패
- 새 서비스 파일 추가 시 unit 테스트 파일 필수

## 시간

- TTL·만료·"N분 전" 비교처럼 **현재 시각**에 따라 결과가 바뀌는 코드를 테스트할 때는 `jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] })` + `jest.setSystemTime(...)`으로 시계를 고정한다. 고정 날짜 데이터 + 실제 시계 조합은 날짜가 지나면 깨진다 (#231)
