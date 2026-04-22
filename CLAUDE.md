# CLAUDE.md — who-tech-backend

> ⚠️ **이 파일은 AGENTS.md를 참조합니다.**
> 실제 규칙은 `AGENTS.md`에 있으며, 이 파일은 하위 호환용입니다.

우아한테크코스 크루 검색 서비스의 백엔드. GitHub 조직(`woowacourse`)의 미션 레포 PR을 수집해 멤버 정보를 저장한다.

- **레포**: https://github.com/iftype/who-tech-backend
- **서버**: Oracle Cloud AMD, iftype.store, SSH: `ssh oracle`
- **PM2 앱 이름**: `backend`

## 핵심 규칙 (AGENTS.md 참고)

```
소스 수정 → /typecheck → /test unit → 둘 다 통과 → 완료 선언
```

### PR/브랜치 규칙 (강제)

- **main 브랜치 직접 푸시 금지** — 반드시 PR 생성 후 머지
- 브랜치명: `feat/#이슈번호-설명` → main PR
- 기능 완성 시에만 PR (중간 커밋 PR 금지)

### 커맨드 도구 (`.claude/commands/`)

| 커맨드       | 실행 내용                         |
| ------------ | --------------------------------- |
| `/typecheck` | `npx tsc --noEmit --skipLibCheck` |
| `/test`      | 인자별 jest 실행                  |
| `/lint`      | `lint:fix` + `format`             |
| `/migrate`   | prisma migrate dev + generate     |

## 참고 문서 (상세)

- [AGENTS.md](AGENTS.md) — 모든 에이전트 규칙
- [아키텍처 및 DB 스키마](.claude/docs/ARCHITECTURE.md)
- [API 엔드포인트](.claude/docs/api.md)
- [환경 설정](.claude/docs/SETUP.md)
- [GitHub Actions](.claude/docs/GITHUB_ACTIONS.md)
- [sync 모듈](.claude/docs/sync.md)
- [어드민](.claude/docs/admin.md)
- [배포](.claude/docs/deploy.md)
- [인프라](.claude/docs/infra.md)
