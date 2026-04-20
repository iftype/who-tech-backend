# GITHUB_ACTIONS.md — CI/CD 파이프라인

## Workflows

### test.yml

- 트리거: PR (develop/main 대상)
- 실행: `npm run test:unit` (유닛 테스트만)

### deploy.yml

- 트리거: main 브랜치 push
- 실행: `POST https://iftype.store/admin/deploy` 웹훅 호출 (Bearer 인증)
- 서버가 detached process로 아래 명령 실행 (응답은 즉시 `{ ok: true }` 반환):
  ```bash
  git pull origin main
  npm install --ignore-scripts
  npx prisma generate
  npm run build
  npx prisma migrate deploy
  pm2 reload ecosystem.config.cjs --update-env
  ```
- Secrets 필요: `ADMIN_SECRET`
- 이 방식을 선택한 이유: Oracle Cloud VCN Security List가 GitHub Actions IP의 port 22 인바운드를 차단 → SSH 방식 불가

### sync.yml

- 트리거: `workflow_dispatch` 수동 트리거 전용 (cron 없음)
- Secrets 필요: `SYNC_URL` (서버 URL, 미설정 시 `https://iftype.store` fallback), `ADMIN_SECRET`

### blog-check.yml

- 트리거: 매시간 cron
- 실행: `POST /admin/blog/sync` 호출 → jobId polling → Slack 웹훅 알림(옵션)

### continuous-sync.yml

- 트리거: 10분마다 cron
- 실행: `POST /admin/sync/continuous` — syncMode=continuous 레포만 수집
