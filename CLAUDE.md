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

## PR/브랜치 규칙

```
feat/#이슈번호-설명 → main PR → 머지
```

## Agent 하네스

자동 로드되는 rules (`.claude/rules/`):

- **항상**: `protocol.md` (완료 기준·커맨드), `conventions.md` (코드 규칙)
- **조건부**: `testing.md` (테스트 작업 시), `sync.md` (sync 모듈), `schema.md` (prisma 변경), `deploy.md` (CI/CD)

커맨드 도구 (`.claude/commands/`): `typecheck` / `test` / `lint` / `migrate`

## 참고 문서 (상세)

- [아키텍처 및 DB 스키마](.claude/docs/ARCHITECTURE.md)
- [API 엔드포인트](.claude/docs/api.md)
- [환경 설정](.claude/docs/SETUP.md)
- [GitHub Actions](.claude/docs/GITHUB_ACTIONS.md)
- [sync 모듈](.claude/docs/sync.md)
- [어드민](.claude/docs/admin.md)
- [배포](.claude/docs/deploy.md)
- [인프라](.claude/docs/infra.md)
