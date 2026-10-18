---
paths:
  - '.github/**'
  - 'Dockerfile'
  - 'ecosystem.config*'
---

# 배포 규칙

## 자동 배포 흐름

```
PR → main (squash, 필수 체크 ci) → CI(main push) 성공 → deploy.yml(workflow_run) → POST /admin/deploy
→ scripts/deploy.sh (setsid로 분리, flock, git pull) → scripts/deploy-run.sh
→ nvm(.nvmrc) → npm install → prisma generate → build → DB 백업 → migrate deploy → pm2 reload
→ /health commit 확인 (실패 시 이전 커밋으로 자동 롤백) → deploy.yml이 /health SHA를 10분간 확인
```

## 수동 배포

```bash
gh workflow run deploy.yml -R iftype/who-tech-backend   # main 최신 커밋 재배포 (같은 검증 포함)
# GitHub Actions를 쓸 수 없을 때: ssh oracle "bash ~/app/who-tech-backend/scripts/deploy.sh"
```

배포 로그: 서버 `/tmp/who-tech-deploy-*.log`, 확인: `curl -s https://iftype.site/health`

## GitHub Actions 워크플로우

| 파일                  | 트리거        | 역할                                        |
| --------------------- | ------------- | ------------------------------------------- |
| `ci.yml`              | PR, main push | lint·format·tsc·test·build (필수 체크 `ci`) |
| `deploy.yml`          | CI 성공(main) | 자동 배포 + `/health` 확인                  |
| `release-please.yml`  | main push     | 릴리즈 PR·태그·CHANGELOG                    |
| `continuous-sync.yml` | 10분 cron     | `POST /admin/sync/continuous`               |
| `blog-check.yml`      | 매시간        | `POST /admin/blog/sync`                     |

## 주의

- `SYNC_URL` 시크릿 미설정 시 `https://iftype.site` fallback
- PM2 앱 이름: `backend` (interpreter `~/.who-tech-backend-node` → nvm Node 24)
- 롤백: 배포 실패 시 서버가 자동 롤백. 코드 문제는 PR revert, DB는 `.claude/docs/backup.md`
- 자세한 내용: `.claude/docs/deploy.md`, `.claude/docs/infra.md`
