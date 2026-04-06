import cron from 'node-cron';
import app, { runtime } from './app.js';

const PORT = process.env['PORT'] ?? 3000;
const BLOG_SYNC_CRON = process.env['BLOG_SYNC_CRON'] ?? '15 * * * *';
const BLOG_SYNC_TIMEZONE = process.env['BLOG_SYNC_TIMEZONE'] ?? 'Asia/Seoul';
const ENABLE_BLOG_SYNC_SCHEDULER = process.env['BLOG_SYNC_SCHEDULER'] !== 'false';

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (ENABLE_BLOG_SYNC_SCHEDULER) {
  cron.schedule(
    BLOG_SYNC_CRON,
    () => {
      void runtime.blogAdminService.syncWorkspaceBlogs('scheduler').catch((error) => {
        console.error('scheduled blog sync failed', error);
      });
    },
    { timezone: BLOG_SYNC_TIMEZONE },
  );

  console.log(`Blog sync scheduler enabled: ${BLOG_SYNC_CRON} (${BLOG_SYNC_TIMEZONE})`);
}
