=== 마지막 세션: 2026-04-11 23:40 ===

### 완료 작업
✅ 서버 배포 문제 해결
  - npm install → node_modules 최신화
  - dist 재생성
  - pm2 kill → 좀비 프로세스 제거
  - API 정상 응답 확인 (`/members?q=test`)

### 원인
- 배포 방식 변경 (CI rsync → git pull) 이후
- PM2가 이전 프로세스를 물고 있음
- `pm2 restart`로는 해결 안 되고 `pm2 kill` 필요

=== 다음 작업 ===

## 1. GitHub Secrets 등록 (배포 전 필수)

CI 배포용 Actions `production` environment Secrets:
- `SSH_PRIVATE_KEY`: `base64 -i ~/.ssh/ssh-key-oracle.key`
- `SERVER_HOST`: `168.107.51.150`
- `SERVER_USER`: 서버 SSH 유저명

## 2. deploy.yml 검토 및 업데이트

현재: `/admin/deploy` 엔드포인트 호출 방식
필요: 배포 시 자동으로 `npm install` 실행되도록 확인

## 3. 배포 후 모니터링

```bash
# 서버 상태 확인
ssh oracle 'pm2 status && pm2 logs backend --lines 20'

# API 테스트
curl https://iftype.store/members?q=test
```
