# 배포 (deploy.md)

## 배포 방식: 서버 Pull 방식

### 자동 배포 흐름

1. `main` 브랜치에 푸시
2. GitHub Actions (`deploy.yml`)가 `POST https://iftype.store/admin/deploy` 호출 (Bearer 인증)
3. 서버가 detached process로 아래 명령 실행:
   ```bash
   git pull origin main
   npm install --ignore-scripts
   npx prisma generate
   npm run build
   npx prisma migrate deploy
   pm2 reload ecosystem.config.cjs --update-env
   ```
4. 응답은 즉시 `{ ok: true, message: 'deploy started' }` 반환 (비동기 실행)

### 이 방식을 선택한 이유

- Oracle Cloud VCN Security List가 GitHub Actions IP의 port 22 인바운드를 차단
- 기존 CI rsync 방식이 SSH timeout으로 실패
- 서버에서 pull하는 방식으로 전환하여 SSH 불필요

### 엔드포인트 위치

`src/app.ts` — `POST /admin/deploy` (line 132-143)

인증: `Authorization: Bearer $ADMIN_SECRET` (GitHub Actions Secrets 사용)

## 서버 환경

- **호스트**: Oracle Cloud AMD Free Tier
- **메모리**: RAM 956MB + Swap 2GB (`/swapfile`)
  - Swap은 tsc 빌드 시 OOM 방지용 필수
- **PM2 앱 이름**: `backend`
- **앱 진입점**: `dist/index.js`

## 수동 배포 (비상용)

```bash
ssh oracle "cd ~/app/who-tech-backend && git pull origin main && npm install --ignore-scripts && npx prisma generate && npm run build && npx prisma migrate deploy && pm2 reload ecosystem.config.cjs --update-env"
```

## 서버 재부팅 후 PM2 복구

```bash
ssh oracle "cd ~/app/who-tech-backend && pm2 start ecosystem.config.cjs && pm2 save"
```

## GitHub Actions Secrets

Environment: `production`

| Secret         | 설명                                   |
| -------------- | -------------------------------------- |
| `ADMIN_SECRET` | `/admin/deploy` 엔드포인트 Bearer 토큰 |

## 배포 확인

- 배포 실행: GitHub Actions → Deploy to Server 워크플로우 로그
- 서버 상태: `ssh oracle "pm2 status"`
- 에러 로그: `ssh oracle "pm2 logs backend"`
