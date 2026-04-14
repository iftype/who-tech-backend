# Backend Deployment Troubleshooting - 2026-04-11

## 문제 현상

서버 배포 후 백엔드 프로세스가 반복적으로 실패하며 서버가 터지는 상황

**에러 메시지:**

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'node-cron' imported from
/home/ubuntu/app/who-tech-backend/dist/index.js
```

**DB 무결성 오류:**

```
Unique constraint failed on the fields: (`cohort`,`missionRepoId`)
```

## 원인 분석

### 1️⃣ 배포 방식 변경

- 이전: CI 자동 배포 (rsync 방식)
- 현재: 서버 pull 방식 (`git pull` → build)
- 문제: 서버에서 `npm install`이 자동으로 실행되지 않음

### 2️⃣ node-cron 패키지 누락

- `package.json`에 `node-cron`이 없음
- 이전 버전 코드에서 사용했던 것으로 추정
- `npm install` 미실행으로 인해 node_modules 동기화 안 됨

### 3️⃣ PM2 좀비 프로세스

- `dist` 재생성 후에도 같은 에러 발생
- PM2가 이전 프로세스를 메모리에 캐싱하고 있었음
- `pm2 restart`로는 해결 불가

## 해결 방법

### ✅ Step 1: npm install

```bash
ssh oracle 'cd ~/app/who-tech-backend && npm install'
```

- 결과: `up to date` (의존성은 올바름)
- 하지만 node_modules는 최신 상태였음

### ✅ Step 2: dist 재생성

```bash
ssh oracle 'cd ~/app/who-tech-backend && rm -rf dist && npm run build'
```

- 오래된 dist를 완전히 제거하고 재생성
- 여전히 에러 발생 (PM2 캐시 문제)

### ✅ Step 3: PM2 완전 초기화 (해결!)

```bash
ssh oracle 'pm2 kill'
ssh oracle 'cd ~/app/who-tech-backend && pm2 start ecosystem.config.cjs'
```

- PM2 데몬 완전 종료
- 새로 시작
- **결과: 정상 작동** ✅

### ✅ Step 4: API 확인

```bash
ssh oracle 'curl -s http://localhost:3000/members?q=test'
# 응답: [] (정상)
```

## 근본 원인

배포 방식이 git pull로 변경되었으나, 서버의 배포 스크립트(`ecosystem.config.cjs`)가 `npm install`을 명시적으로 실행하도록 설정되지 않았음.

## 예방 조치

### 1️⃣ 배포 스크립트 점검

```bash
# ecosystem.config.cjs 확인
cat ~/app/who-tech-backend/ecosystem.config.cjs | grep -A 10 "deploy:"
```

### 2️⃣ 배포 후 체크리스트

```bash
# 1. npm install 확인
npm list node-cron 2>/dev/null || echo "node-cron not found"

# 2. 빌드 확인
npm run build

# 3. PM2 상태
pm2 status

# 4. API 테스트
curl http://localhost:3000/members?q=test
```

### 3️⃣ 향후 배포 명령어

```bash
ssh oracle 'cd ~/app/who-tech-backend && \
  pm2 kill && \
  git pull && \
  npm install && \
  npm run build && \
  pm2 start ecosystem.config.cjs && \
  pm2 save'
```

## 교훈

- ❌ `pm2 restart`는 좀비 프로세스 제거 불가
- ✅ `pm2 kill` → 재시작이 더 안전
- ⚠️ 배포 방식 변경 시 배포 스크립트도 함께 검토 필수
- 📝 서버에서 `npm install` 없이는 node_modules 동기화 안 됨

## 최종 해결책

### 적용된 수정 (2026-04-11 23:45)

```typescript
// app.ts 수정
app.post('/admin/deploy', (req, res): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');
  if (token !== process.env['ADMIN_SECRET']) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json({ ok: true, message: 'deploy started' });
  const child = spawn(
    'bash',
    [
      '-c',
      'cd ~/app/who-tech-backend && git pull origin main && npm install --ignore-scripts && npx prisma generate && npm run build && npx prisma migrate deploy && pm2 restart backend',
    ],
    { detached: true, stdio: 'ignore', shell: false },
  );
  child.unref();
});
```

**변경 사항:**

1. ✅ ADMIN_SECRET 인증 추가 (보안)
2. ✅ `npm install --ignore-scripts` 명시 (의존성 동기화)
3. ✅ `pm2 reload` → `pm2 restart` (안정성)

## 참고

- 서버 로그: `/home/ubuntu/.pm2/logs/backend-error.log`
- 상태 확인: `pm2 logs backend --lines 30 --nostream`
- GitHub Actions: `deploy.yml` (main push 시 자동 트리거)
