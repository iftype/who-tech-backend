import app from './app.js';
import { startSyncJob } from './jobs/sync.job.js';

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startSyncJob();
});
