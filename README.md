# backend

우아한테크코스 크루 검색 서비스 백엔드. Node.js 24 (`.nvmrc`, `nvm use`) / Express / Prisma / SQLite.

## 빠른 시작

```bash
nvm use            # .nvmrc (Node 24)
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

## 구조

- [ARCHITECTURE.md](ARCHITECTURE.md) — 계층과 의존 규칙, 새 기능 추가 방법, 안전망, 구조 개선 전후 수치
- [docs/adr](docs/adr) — 결정 기록 (포트로 순환 끊기, 확장→이전→축소 DB 변경, 안전망, 어드민 색)

## 상세 문서

`.claude/docs/` 참조:

- `ARCHITECTURE.md` — 수집 흐름, DB 스키마, 디렉토리
- `api.md` — 공개 API, 데이터 모델
- `admin.md` — 어드민 API, UI 구조
- `sync.md` — PR 수집, 블로그 RSS
- `db-changes.md` — DB 구조 변경 절차와 결정 기록
- `infra.md`·`deploy.md` — 서버, CI/CD, 배포
