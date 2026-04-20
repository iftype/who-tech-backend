---
paths:
  - '.github/**'
  - 'Dockerfile'
  - 'ecosystem.config*'
---

# 배포 규칙

## 자동 배포 흐름

```
main push → deploy.yml → POST /admin/deploy 웹훅
→ git pull + npm install + prisma generate + migrate deploy + build + pm2 reload
```

## 수동 배포

```bash
ssh oracle "cd ~/app/who-tech-backend && git pull origin main && npm install --ignore-scripts && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 reload backend --update-env"
```

## GitHub Actions 워크플로우

| 파일                  | 트리거    | 역할                          |
| --------------------- | --------- | ----------------------------- |
| `deploy.yml`          | main push | 자동 배포                     |
| `continuous-sync.yml` | 10분 cron | `POST /admin/sync/continuous` |
| `blog-check.yml`      | 매시간    | `POST /admin/blog/sync`       |

## 주의

- `SYNC_URL` 시크릿 미설정 시 `https://iftype.store` fallback
- PM2 앱 이름: `backend`
- 자세한 내용: `.claude/docs/deploy.md`, `.claude/docs/infra.md`
