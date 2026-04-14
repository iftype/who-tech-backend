# CLAUDE.md — Backend

우아한테크코스 크루 검색 서비스의 백엔드. GitHub 조직(`woowacourse`)의 미션 레포 PR을 수집해 멤버 정보를 저장한다.

- **레포**: https://github.com/iftype/who-tech-backend
- **서버**: Oracle Cloud AMD, iftype.store, SSH: `ssh oracle`
- **PM2 앱 이름**: `backend`

## 주요 명령어

```bash
npm run dev              # tsx watch 핫리로드
npm run test:unit        # 유닛 테스트 (CI)
npm run test:integration # 통합 테스트 (로컬, DB 필요)
npm run lint:fix
npm run format
npx prisma migrate dev   # 마이그레이션 생성 + 적용
npm run seed             # Role + Workspace 시드
```

## 컨벤션

- ESM (import/export), CommonJS 사용 금지
- TypeScript strict mode — `any` 타입 사용 금지
- 에러는 반드시 타입 명시
- Prisma 쿼리는 service 레이어에서만
- commitlint 적용 (feat / fix / refactor / test / chore)

## 금지

- `any` 타입
- `console.log` 커밋
- CommonJS (`require` / `module.exports`)

## PR/브랜치 규칙

```
feat/#이슈번호-설명 → main PR → 머지
```

- PR은 기능 완성 시에만 (중간 커밋 PR 금지)
- 커밋 메시지: Conventional Commits, subject 소문자

## 참고 문서

- [아키텍처 및 DB 스키마](.claude/ARCHITECTURE.md)
- [API 엔드포인트](.claude/API.md)
- [환경 설정 및 테스트](.claude/SETUP.md)
- [GitHub Actions CI/CD](.claude/GITHUB_ACTIONS.md)
