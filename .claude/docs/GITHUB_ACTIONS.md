# GITHUB_ACTIONS.md — CI/CD 파이프라인

## Workflows

### ci.yml

- 트리거: PR(main), main push, `workflow_dispatch`(release-please 릴리즈 PR용)
- 실행: `lint` → `format:check` → `tsc --noEmit` → `npm test`(unit + integration, 임시 SQLite) → `build`(admin-spa 포함)
- job 이름 `ci`가 main 브랜치 보호의 **필수 상태 체크**

### deploy.yml

- 트리거: `workflow_run` — main의 CI가 **성공**한 push 커밋만. 비상용 `workflow_dispatch`
- 실행: `POST https://iftype.site/admin/deploy` → 서버 `scripts/deploy.sh` → `scripts/deploy-run.sh` (`.claude/docs/deploy.md`)
- 배포 후 `/health`의 `commit`이 대상 SHA가 될 때까지 최대 10분 확인, 아니면 실패 (서버는 실패 시 자동 롤백)
- Secrets 필요: `ADMIN_SECRET`
- 이 방식을 선택한 이유: Oracle Cloud VCN Security List가 GitHub Actions IP의 port 22 인바운드를 차단 → SSH 방식 불가

### release-please.yml

- 트리거: main push
- 실행: 릴리즈 PR(버전·CHANGELOG) 생성/갱신, 머지 시 태그·GitHub Release. 릴리즈 PR에 CI를 dispatch하고 승인 대기 실행을 승인 (GITHUB_TOKEN PR 제약 우회)

### sync.yml

- 트리거: `workflow_dispatch` 수동 트리거 전용 (cron 없음)
- Secrets 필요: `SYNC_URL` (서버 URL, 미설정 시 `https://iftype.site` fallback), `ADMIN_SECRET`

### blog-check.yml

- 트리거: 매시간 cron
- 실행: `POST /admin/blog/sync` 호출 → jobId polling → Slack 웹훅 알림(옵션)

### continuous-sync.yml

- 트리거: 10분마다 cron
- 실행: `POST /admin/sync/continuous` — syncMode=continuous 레포만 수집

### tecotalk-sync.yml

- 트리거: 매주 일요일 18:00 UTC cron (+ `workflow_dispatch`)
- 실행: `POST /admin/tecotalk/sync` — 테코톡 재생목록 수집 + 멤버 매칭 + 조회수 갱신
- 서버 환경변수 필요: `YOUTUBE_API_KEY` (재생목록 ID는 `TECOTALK_PLAYLIST_ID` 로 오버라이드 가능)
- Secrets: `SYNC_URL`(미설정 시 `https://iftype.site` fallback), `ADMIN_SECRET`
