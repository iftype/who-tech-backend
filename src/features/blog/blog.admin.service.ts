import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { TeamBlogRepository } from '../../db/repositories/team-blog.repository.js';
import type { WorkspaceService } from '../workspace/index.js';
import type { BlogService } from './blog.service.js';
import type { ActivityLogService } from '../activity-log/index.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { HttpError } from '../../shared/http.js';
import type { BlogSyncResult, BlogSyncSource, SyncProgress } from '../sync/index.js';
import { backfillMemberBlogLinks } from './blog.backfill.js';

export function createBlogAdminService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  teamBlogRepo: TeamBlogRepository;
  workspaceService: WorkspaceService;
  blogService: BlogService;
  activityLogService: ActivityLogService;
  octokit: Octokit;
}) {
  const { memberRepo, blogPostRepo, teamBlogRepo, workspaceService, blogService, activityLogService, octokit } = deps;
  const runWorkspaceBlogSync = async (
    source: BlogSyncSource,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<BlogSyncResult> => {
    const workspace = await workspaceService.getOrThrow();
    const isAutomated = source === 'github-actions' || source === 'scheduler';
    const sourceLabel = source === 'scheduler' ? '스케줄러' : '자동';

    if (!workspace.blogSyncEnabled && isAutomated) {
      await activityLogService.addLog('blog_sync_info', `${sourceLabel} 블로그 Sync 스킵 — blogSyncEnabled=false`);
      onProgress?.({ total: 0, processed: 0, synced: 0, percent: 100, phase: '스킵됨' });
      return { synced: 0, deleted: 0, failures: [], skipped: true };
    }

    try {
      const result = await blogService.syncBlogs(workspace.id, onProgress);

      const logLevel = result.failures.length > 0 ? 'blog_sync_error' : 'blog_sync';
      const logMessage = `${isAutomated ? sourceLabel : '수동'} 블로그 Sync 완료 — 수집 ${result.synced}건, 삭제 ${result.deleted}건, 실패 ${result.failures.length}건`;
      await activityLogService.addLog(logLevel, logMessage);

      for (const failure of result.failures.slice(0, 10)) {
        const target = failure.rssUrl ?? failure.blog;
        await activityLogService.addLog(
          'blog_sync_error',
          `  └ ${failure.githubId} ${failure.step}: ${target} — ${failure.error}`,
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await activityLogService.addLog(
        'blog_sync_error',
        `${isAutomated ? sourceLabel : '수동'} 블로그 Sync 실패: ${message}`,
      );
      throw error;
    }
  };

  return {
    syncTeamBlogs: async () => {
      const workspace = await workspaceService.getOrThrow();
      const result = await blogService.syncTeamBlogs(workspace.id);
      await activityLogService.addLog(
        result.failures.length > 0 ? 'blog_sync_error' : 'blog_sync',
        `팀 블로그 수동 Sync 완료 — 수집 ${result.synced}건, 삭제 ${result.deleted}건, 실패 ${result.failures.length}건`,
      );
      return result;
    },

    // 싱크 큐(블로그 레인)가 부르는 실행 함수. 작업 상태·진행·결과는 큐가 들고 있다
    executeWorkspaceBlogSync: async (
      source: BlogSyncSource = 'manual',
      onProgress?: (progress: SyncProgress) => void,
    ) => runWorkspaceBlogSync(source, onProgress),

    backfillWorkspaceBlogLinks: async (limit = 30, cohort?: number) => {
      const workspace = await workspaceService.getOrThrow();
      return backfillMemberBlogLinks(memberRepo, octokit, workspace.id, limit, cohort);
    },

    getNewPosts: async (sinceMinutes = 65) => {
      const workspace = await workspaceService.getOrThrow();
      const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
      const posts = await blogPostRepo.findSince(workspace.id, since);
      return posts.map((p) => {
        const cohorts = buildCohortList(p.member.memberCohorts);
        return {
          url: p.url,
          title: p.title,
          publishedAt: p.publishedAt,
          member: {
            githubId: p.member.githubId,
            nickname: resolveDisplayNickname(p.member.manualNickname, p.member.nicknameStats, p.member.nickname),
            cohort: cohorts[0]?.cohort ?? null,
          },
        };
      });
    },

    getTeamBlogStatus: async () => {
      const workspace = await workspaceService.getOrThrow();
      const teamBlogs = await blogService.ensureTeamBlogs(workspace.id);
      return Promise.all(
        teamBlogs.map(async (teamBlog) => {
          const posts = await blogPostRepo.findByMember(teamBlog.memberId, 1, 20);
          return { ...teamBlog, posts: posts.archive };
        }),
      );
    },

    updateTeamBlog: async (
      id: number,
      input: { name?: string; blogUrl?: string; rssUrl?: string; avatarUrl?: string | null; enabled?: boolean },
    ) => {
      const workspace = await workspaceService.getOrThrow();
      const teamBlog = await teamBlogRepo.findAll(workspace.id).then((blogs) => blogs.find((blog) => blog.id === id));
      if (!teamBlog) throw new HttpError(404, 'team blog not found');
      return teamBlogRepo.update(id, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.blogUrl !== undefined ? { blogUrl: input.blogUrl.trim() } : {}),
        ...(input.rssUrl !== undefined ? { rssUrl: input.rssUrl.trim() } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      });
    },
  };
}
export type BlogAdminService = ReturnType<typeof createBlogAdminService>;
