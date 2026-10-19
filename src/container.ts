import { PrismaClient } from '@prisma/client';

// Repositories
import { createWorkspaceRepository } from './db/repositories/workspace.repository.js';
import { createMemberRepository } from './db/repositories/member.repository.js';
import { createMissionRepoRepository } from './db/repositories/mission-repo.repository.js';
import { createSubmissionRepository } from './db/repositories/submission.repository.js';
import { createSyncWriteRepository } from './db/repositories/sync-write.repository.js';
import { createBlogPostRepository } from './db/repositories/blog-post.repository.js';
import { createTeamBlogRepository } from './db/repositories/team-blog.repository.js';
import { createCohortRepoRepository } from './db/repositories/cohort-repo.repository.js';
import { createActivityLogRepository } from './db/repositories/activity-log.repository.js';
import { createPersonRepository } from './db/repositories/person.repository.js';
import { createBannedWordRepository } from './db/repositories/banned-word.repository.js';
import { createIgnoredDomainRepository } from './db/repositories/ignored-domain.repository.js';
import { createTecoTalkRepository } from './db/repositories/tecotalk.repository.js';

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
import { createMemberPublicService } from './features/member/member.public.service.js';
import { createArchiveService } from './features/archive/archive.service.js';
import { createTecoTalkService } from './features/tecotalk/tecotalk.service.js';
import { createOctokit } from './infra/github/github.client.js';

// 객체 그래프 조립 (Composition Root). 저장소 → 서비스 순서로 만들고 서로 주입한다.
// sync 작업 큐에는 repo·blog 서비스를 포트(RepoSyncRunner·WorkspaceBlogSyncRunner)로 꽂는다
export function createContainer() {
  const db = new PrismaClient();
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  const workspaceRepo = createWorkspaceRepository(db);
  const memberRepo = createMemberRepository(db);
  const missionRepoRepo = createMissionRepoRepository(db);
  const submissionRepo = createSubmissionRepository(db);
  const syncWriteRepo = createSyncWriteRepository(db);
  const blogPostRepo = createBlogPostRepository(db);
  const teamBlogRepo = createTeamBlogRepository(db);
  const cohortRepoRepo = createCohortRepoRepository(db);
  const activityLogRepo = createActivityLogRepository(db);
  const personRepo = createPersonRepository(db);
  const bannedWordRepo = createBannedWordRepository(db);
  const ignoredDomainRepo = createIgnoredDomainRepository(db);
  const tecoTalkRepo = createTecoTalkRepository(db);

  const workspaceService = createWorkspaceService({ workspaceRepo });
  const activityLogService = createActivityLogService({ activityLogRepo, workspaceService });
  const syncService = createSyncService({
    syncWriteRepo,
    missionRepoRepo,
    workspaceRepo,
    bannedWordRepo,
    ignoredDomainRepo,
    cohortRepoRepo,
    activityLogService,
  });
  const memberService = createMemberService({
    memberRepo,
    blogPostRepo,
    bannedWordRepo,
    workspaceService,
    octokit,
    submissionRepo,
    syncService,
  });
  const repoService = createRepoService({ missionRepoRepo, workspaceService, syncService, octokit });
  const blogService = createBlogService({ memberRepo, blogPostRepo, teamBlogRepo });
  const cohortRepoService = createCohortRepoService({ cohortRepoRepo, missionRepoRepo, workspaceService });
  const blogAdminService = createBlogAdminService({
    memberRepo,
    blogPostRepo,
    teamBlogRepo,
    workspaceService,
    blogService,
    activityLogService,
    octokit,
  });
  const memberPublicService = createMemberPublicService({
    memberRepo,
    blogPostRepo,
    tecoTalkRepo,
    cohortRepoRepo,
    bannedWordRepo,
    workspaceService,
    activityLogService,
    blogService,
    octokit,
  });
  const archiveService = createArchiveService({ memberRepo, cohortRepoRepo, workspaceService });
  const tecoTalkService = createTecoTalkService({ tecoTalkRepo, memberRepo, workspaceService });
  const syncAdminService = createSyncAdminService({
    cohortRepoRepo,
    memberRepo,
    missionRepoRepo,
    workspaceService,
    syncService,
    activityLogService,
    octokit,
    repoService,
    blogAdminService,
  });

  return {
    db,
    octokit,
    workspaceRepo,
    memberRepo,
    missionRepoRepo,
    submissionRepo,
    blogPostRepo,
    teamBlogRepo,
    cohortRepoRepo,
    activityLogRepo,
    personRepo,
    bannedWordRepo,
    ignoredDomainRepo,
    tecoTalkRepo,
    workspaceService,
    activityLogService,
    syncService,
    memberService,
    repoService,
    blogService,
    cohortRepoService,
    blogAdminService,
    memberPublicService,
    archiveService,
    tecoTalkService,
    syncAdminService,
  };
}
