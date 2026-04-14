# SETUP.md — 환경 설정, 테스트, 마이그레이션

## 환경변수 (.env)

```
DATABASE_URL=file:./prisma/dev.db
GITHUB_TOKEN=...
ADMIN_SECRET=...
```

## DB 마이그레이션

```bash
npx prisma migrate dev        # 마이그레이션 생성 + 적용 (개발)
npx prisma migrate deploy     # 프로덕션 마이그레이션 적용
npm run seed                  # Role + Workspace 시드 (어드민 discover/sync로 미션 레포 추가)
```

스키마 대개편 후 마이그레이션 폴더를 비우고 다시 만들기 → README「스키마를 재조정한 뒤…」절차 참고.

## 빌드

```bash
npm run build   # dist/ 출력 (PM2 배포 시 사용)
```

## 테스트

```bash
npm run test:unit        # 유닛 테스트 — mock 기반, DB 불필요. CI에서 실행
npm run test:integration # 통합 테스트 — 실제 SQLite DB. 로컬에서만 실행

# 단일 파일 실행
NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/unit/foo.test.ts
```

### 테스트 구조

- `__tests__/unit/` — mock 기반, DB 불필요. CI(`test.yml`)에서 실행
- `__tests__/integration/` — 실제 SQLite DB. 로컬에서만 실행
- `jest.config.cjs` 사용 (`"type": "module"` 때문에 `.ts` 불가)
- `@octokit`은 ESM이라 `transformIgnorePatterns`에서 별도 처리
