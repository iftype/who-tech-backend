# 배포 (deploy.md)

## 배포 방식: 서버 Pull 방식

### 자동 배포 흐름

1. PR을 `main`에 squash 머지 (브랜치 보호: 필수 체크 `ci`, 최신 main 기준)
2. `main` push로 CI(`ci.yml`) 실행 → 성공하면 `deploy.yml`이 `workflow_run`으로 실행
3. `deploy.yml`이 `POST https://iftype.site/admin/deploy` 호출 (Bearer 인증)
4. 서버: `scripts/deploy.sh`가 `setsid -f`로 분리 실행(pm2 reload에 같이 종료되지 않음), `flock`으로 직렬화, `git pull` 후 새로 받은 `scripts/deploy-run.sh` 실행
5. `deploy-run.sh`: nvm(`.nvmrc`) → `npm install --ignore-scripts` → `prisma generate` → `build` → **DB 백업**(`~/backups/who-tech/pre-deploy`) → `migrate deploy` → `pm2 reload backend --update-env` → `/health`의 `commit` 확인
6. 어느 단계든 실패하면 이전 커밋으로 checkout → 재빌드 → reload (**DB 마이그레이션은 자동 롤백 안 됨**)
7. `deploy.yml`이 `/health`의 `commit`이 대상 SHA가 될 때까지 최대 10분 확인 → 아니면 워크플로 실패

### 이 방식을 선택한 이유

- Oracle Cloud VCN Security List가 GitHub Actions IP의 port 22 인바운드를 차단
- 기존 CI rsync 방식이 SSH timeout으로 실패
- 서버에서 pull하는 방식으로 전환하여 SSH 불필요

### 엔드포인트 위치

`src/app.ts` — `POST /admin/deploy` (line 132-143)

인증: `Authorization: Bearer $ADMIN_SECRET` (GitHub Actions Secrets 사용)

## 서버 환경

- **Node**: nvm Node 24.22.0 (`.nvmrc`), pm2 7 데몬도 Node 24. backend interpreter = `~/.who-tech-backend-node`(deploy-run.sh가 갱신하는 링크)
- **롤백 (수동)**: `ln -sfn /usr/bin/node ~/.who-tech-backend-node && pm2 reload backend` → 시스템 Node 20으로 즉시 전환

- **호스트**: Oracle Cloud AMD Free Tier
- **메모리**: RAM 956MB + Swap 2GB (`/swapfile`)
  - Swap은 tsc 빌드 시 OOM 방지용 필수
- **PM2 앱 이름**: `backend`
- **앱 진입점**: `dist/index.js`

## 수동 배포 (비상용)

```bash
gh workflow run deploy.yml -R iftype/who-tech-backend        # 권장: 같은 검증 포함
ssh oracle "bash ~/app/who-tech-backend/scripts/deploy.sh"    # Actions를 쓸 수 없을 때
```

## 서버 재부팅 후 PM2 복구

systemd `pm2-ubuntu.service`가 nvm Node 24의 pm2로 `pm2 resurrect`를 실행해 자동 복구한다.
수동 복구가 필요하면 (환경변수는 pm2가 아니라 `.env`에서 넣어야 함):

```bash
ssh oracle 'cd ~/app/who-tech-backend && set -a && . ./.env && set +a && pm2 start ecosystem.config.cjs && pm2 save'
```

Node 버전을 바꾼 뒤에는 systemd 유닛이 버전별 경로를 가리키므로 `pm2 startup`을 다시 실행한다.

## GitHub Actions Secrets

Environment: `production`

| Secret         | 설명                                   |
| -------------- | -------------------------------------- |
| `ADMIN_SECRET` | `/admin/deploy` 엔드포인트 Bearer 토큰 |

## 배포 확인

- 배포 결과: `curl -s https://iftype.site/health` → `commit`이 머지 SHA, `version`이 릴리즈 버전
- 배포 실행: GitHub Actions → Deploy to Server 워크플로우 로그 (실패 = 배포 실패 또는 자동 롤백)
- 서버 배포 로그: `ssh oracle "ls -t /tmp/who-tech-deploy-*.log | head -1 | xargs tail -30"`
- 서버 상태: `ssh oracle "pm2 status"`
- 에러 로그: `ssh oracle "pm2 logs backend"`

## 서버 crontab (싱크 트리거, #229)

GitHub Actions `schedule`은 짧은 주기를 지키지 못한다(2026-10-22 측정: 10분 설정이 중앙값 201분, 30분 설정이 250분).
그래서 싱크 트리거는 서버 crontab이 `localhost`로 부르고, GitHub Actions 워크플로는 백업으로 남긴다.

```sh
mkdir -p ~/logs
crontab -l 2>/dev/null | { cat; \
  echo '*/10 * * * * /home/ubuntu/app/who-tech-backend/scripts/sync-trigger.sh continuous >> /home/ubuntu/logs/sync-trigger.log 2>&1'; \
  echo '7,37 * * * * /home/ubuntu/app/who-tech-backend/scripts/sync-trigger.sh blog >> /home/ubuntu/logs/sync-trigger.log 2>&1'; \
  echo '23 * * * * /home/ubuntu/app/who-tech-backend/scripts/sync-trigger.sh activity >> /home/ubuntu/logs/sync-trigger.log 2>&1'; \
} | crontab -
```

확인: `tail ~/logs/sync-trigger.log`, 어드민 싱크 탭 최근 작업(blog 소스 `scheduler`). 되돌리기: `crontab -e`에서 두 줄 삭제.
uptime 감시는 서버 밖에 있어야 하므로 GitHub Actions에 남는다(실제 간격이 4시간대 — 외부 모니터 도입은 별도 결정).
