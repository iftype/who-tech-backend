# backend

우아한테크코스 크루 검색 서비스 백엔드. Node.js 20 / Express / Prisma / SQLite.

## 빠른 시작

```bash
npm install
npx prisma generate
npm run seed        # Role + Workspace 초기화
npm run dev         # http://localhost:3001
```

## 주요 명령어

```bash
npm run dev          # tsx watch 핫리로드
npm run build        # TypeScript 빌드
npm run test:unit    # 단위 테스트
npm run lint:fix     # ESLint 자동 수정
npx prisma migrate dev   # 마이그레이션 생성+적용
```

## 환경변수 (.env)

```
DATABASE_URL=file:./prisma/dev.db
GITHUB_TOKEN=...
ADMIN_SECRET=...
```

## 상세 문서

프로젝트 루트 `.claude/backend/` 참조:

- `overview.md` — 아키텍처, 배포, DB 모델
- `api.md` — 공개 API, 데이터 모델
- `admin.md` — 어드민 API, UI
- `sync.md` — PR 수집, 블로그 RSS
- `infra.md` — 서버, CI/CD, 배포
