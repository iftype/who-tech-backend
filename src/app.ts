import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { adminAuth } from './shared/middleware/auth.js';
import { errorHandler } from './shared/middleware/error.js';

// Repositories
import { createWorkspaceRepository } from './db/repositories/workspace.repository.js';
import { createMemberRepository } from './db/repositories/member.repository.js';
import { createMissionRepoRepository } from './db/repositories/mission-repo.repository.js';
import { createSubmissionRepository } from './db/repositories/submission.repository.js';
import { createBlogPostRepository } from './db/repositories/blog-post.repository.js';
import { createCohortRepoRepository } from './db/repositories/cohort-repo.repository.js';
import { createActivityLogRepository } from './db/repositories/activity-log.repository.js';
import { createPersonRepository } from './db/repositories/person.repository.js';
import { createBannedWordRepository } from './db/repositories/banned-word.repository.js';
import { createIgnoredDomainRepository } from './db/repositories/ignored-domain.repository.js';

// Services
import { createWorkspaceService } from './features/workspace/workspace.service.js';
import { createMemberService } from './features/member/member.service.js';
import { createSyncService } from './features/sync/sync.service.js';
import { createSyncAdminService } from './features/sync/sync.admin.service.js';
import { createRepoService } from './features/repo/repo.service.js';
import { createBlogService } from './features/blog/blog.service.js';
import { createBlogAdminService } from './features/blog/blog.admin.service.js';
import { createCohortRepoService } from './features/cohort-repo/cohort-repo.service.js';
import { createActivityLogService } from './features/activity-log/activity-log.service.js';
import { createOctokit } from './features/sync/github.service.js';

// Routers
import { createWorkspaceRouter } from './features/workspace/workspace.route.js';
import { createMemberRouter } from './features/member/member.route.js';
import { createRepoRouter } from './features/repo/repo.route.js';
import { createSyncRouter } from './features/sync/sync.route.js';
import { createBlogRouter } from './features/blog/blog.route.js';
import { createCohortRepoRouter } from './features/cohort-repo/cohort-repo.route.js';
import { createActivityLogRouter } from './features/activity-log/activity-log.route.js';
import { createPersonRouter } from './features/person/person.route.js';
import { createBannedWordRouter } from './features/banned-word/banned-word.route.js';
import { createIgnoredDomainRouter } from './features/ignored-domain/ignored-domain.route.js';
import { createMemberPublicService } from './features/member/member.public.service.js';
import { createMemberPublicRouter } from './features/member/member.public.route.js';
import { createArchiveService } from './features/archive/archive.service.js';
import { createArchiveRouter } from './features/archive/archive.route.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = existsSync(join(__dirname, 'public'))
  ? join(__dirname, 'public')
  : join(process.cwd(), 'src', 'public');

// --- Composition Root ---
const db = new PrismaClient();
const octokit = createOctokit(process.env['GITHUB_TOKEN']);

const workspaceRepo = createWorkspaceRepository(db);
const memberRepo = createMemberRepository(db);
const missionRepoRepo = createMissionRepoRepository(db);
const submissionRepo = createSubmissionRepository(db);
const blogPostRepo = createBlogPostRepository(db);
const cohortRepoRepo = createCohortRepoRepository(db);
const activityLogRepo = createActivityLogRepository(db);
const personRepo = createPersonRepository(db);
const bannedWordRepo = createBannedWordRepository(db);
const ignoredDomainRepo = createIgnoredDomainRepository(db);

const workspaceService = createWorkspaceService({ workspaceRepo });
const activityLogService = createActivityLogService({ activityLogRepo, workspaceService });
const syncService = createSyncService({
  memberRepo,
  missionRepoRepo,
  submissionRepo,
  workspaceRepo,
  bannedWordRepo,
  ignoredDomainRepo,
  activityLogService,
});
const memberService = createMemberService({ memberRepo, blogPostRepo, bannedWordRepo, workspaceService, octokit });
const repoService = createRepoService({ missionRepoRepo, workspaceService, syncService, octokit });
const blogService = createBlogService({ memberRepo, blogPostRepo });
const cohortRepoService = createCohortRepoService({ cohortRepoRepo, missionRepoRepo, workspaceService });
const blogAdminService = createBlogAdminService({
  memberRepo,
  blogPostRepo,
  workspaceService,
  blogService,
  activityLogService,
  octokit,
});
const memberPublicService = createMemberPublicService({ memberRepo, blogPostRepo, cohortRepoRepo, workspaceService });
const archiveService = createArchiveService({ memberRepo, cohortRepoRepo, workspaceService });
const syncAdminService = createSyncAdminService({
  cohortRepoRepo,
  memberRepo,
  missionRepoRepo,
  workspaceService,
  syncService,
  octokit,
});

// --- Express App ---
const app = express();
app.use(express.json());
app.use('/admin/ui', express.static(publicDir));

app.get('/', (_req, res) => {
  res.json({ message: 'who.tech API' });
});

app.get('/guide', (_req, res) => {
  res.sendFile(join(publicDir, 'guide.html'));
});

app.use('/members', createMemberPublicRouter(memberPublicService));

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

app.use('/admin', adminAuth);
app.use('/admin/workspace', createWorkspaceRouter(workspaceService));
app.use('/admin/repos', createRepoRouter(repoService));
app.use('/admin', createSyncRouter(syncAdminService));
app.use('/admin', createBlogRouter(blogAdminService));
app.use('/admin/members', createMemberRouter(memberService));
app.use('/admin/cohort-repos', createCohortRepoRouter(cohortRepoService));
app.use('/admin/logs', createActivityLogRouter(activityLogService));
app.use('/admin', createPersonRouter({ personRepo, memberRepo, workspaceService }));
app.use('/admin/banned-words', createBannedWordRouter({ bannedWordRepo, workspaceService }));
app.use('/admin/ignored-domains', createIgnoredDomainRouter({ ignoredDomainRepo, workspaceService }));
app.use('/admin/archive', createArchiveRouter(archiveService));

app.use(errorHandler);

export default app;
