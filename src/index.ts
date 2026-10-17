import app from './app.js';

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // PM2 wait_ready: graceful reload 시 new 프로세스가 준비됐음을 알림
  if (process.send) process.send('ready');
});
