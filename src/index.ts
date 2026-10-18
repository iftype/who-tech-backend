import app from './app.js';

const PORT = process.env['PORT'] ?? 3000;

// 처리되지 않은 Promise 거부는 기록만 하고 계속 실행한다 (pm2 아래 기존 동작과 동일)
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// 동기 예외 이후의 상태는 신뢰할 수 없으므로 기록 후 종료 → pm2가 재시작
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // PM2 wait_ready: graceful reload 시 new 프로세스가 준비됐음을 알림
  if (process.send) process.send('ready');
});
