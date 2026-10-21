import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { adminAuth, bearerToken, isAdminToken } from './shared/middleware/auth.js';
import { errorHandler } from './shared/middleware/error.js';
import { createContainer } from './container.js';

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
import { createMemberPublicRouter } from './features/member/member.public.route.js';
import { createArchiveRouter } from './features/archive/archive.route.js';
import { createTecoTalkRouter } from './features/tecotalk/tecotalk.route.js';
import { createHealthRouter } from './features/health/health.route.js';
import { createDeployRouter } from './features/deploy/deploy.route.js';
import { createDeployService } from './features/deploy/deploy.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = existsSync(join(__dirname, 'public'))
  ? join(__dirname, 'public')
  : join(process.cwd(), 'src', 'public');

// src/·dist/ 어디서 실행해도 한 단계 위가 레포 루트
const repoRoot = join(__dirname, '..');
const appVersion = (JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version;
const appCommit = (() => {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
})();

// --- Composition Root (src/container.ts) ---
const {
  db,
  memberRepo,
  personRepo,
  bannedWordRepo,
  ignoredDomainRepo,
  workspaceService,
  activityLogService,
  memberService,
  repoService,
  cohortRepoService,
  blogAdminService,
  memberPublicService,
  archiveService,
  tecoTalkService,
  syncAdminService,
} = createContainer();

// --- Express App ---
const app = express();
// nginx(같은 서버)가 넘긴 X-Forwarded-For로 클라이언트 IP를 읽는다 (횟수 제한 기준)
app.set('trust proxy', 'loopback');
app.use(compression());
app.use(express.json());
app.use('/admin/ui', express.static(publicDir));
// 사이트 루트 경로로 주는 파일. 팀 블로그 기본 아바타 '/rilog-avatar.png'는 웹 기준 경로라 어드민(이 서버)에서도 같은 경로로 준다
app.use(express.static(join(publicDir, 'site-root'), { index: false }));

app.get('/admin', (_req, res) => {
  res.redirect('/admin/ui/admin-dist/');
});

app.get('/', (_req, res) => {
  res.json({ message: 'who.tech API' });
});

app.get('/guide', (_req, res) => {
  res.sendFile(join(publicDir, 'guide.html'));
});

app.use(
  '/health',
  createHealthRouter({
    version: appVersion,
    commit: appCommit,
    pingDb: async () => {
      await db.$queryRaw`SELECT 1`;
    },
  }),
);

app.use('/members', createMemberPublicRouter(memberPublicService));

app.use(
  '/admin',
  createDeployRouter({
    service: createDeployService({ scriptPath: join(__dirname, '..', 'scripts', 'deploy.sh') }),
    isAuthorized: isAdminToken,
    bearerToken,
  }),
);

app.use('/admin', adminAuth);
app.use('/admin/workspace', createWorkspaceRouter(workspaceService));
app.use('/admin/repos', createRepoRouter(repoService, syncAdminService));
app.use('/admin', createSyncRouter(syncAdminService));
app.use('/admin', createBlogRouter(blogAdminService, syncAdminService));
app.use('/admin/members', createMemberRouter(memberService, syncAdminService));
app.use('/admin/cohort-repos', createCohortRepoRouter(cohortRepoService));
app.use('/admin/logs', createActivityLogRouter(activityLogService));
app.use('/admin', createPersonRouter({ personRepo, memberRepo, workspaceService }));
app.use('/admin/banned-words', createBannedWordRouter({ bannedWordRepo, workspaceService }));
app.use('/admin/ignored-domains', createIgnoredDomainRouter({ ignoredDomainRepo, workspaceService }));
app.use('/admin/archive', createArchiveRouter(archiveService));
app.use('/admin/tecotalk', createTecoTalkRouter(tecoTalkService));

app.use(errorHandler);

export default app;
