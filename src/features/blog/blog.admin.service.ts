import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { BlogService, BlogSyncFailure } from './blog.service.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { HttpError } from '../../shared/http.js';
import { randomUUID } from 'crypto';
import { backfillMemberBlogLinks } from './blog.backfill.js';
// blog.admin.service.ts

export function createBlogAdminService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  workspaceService: WorkspaceService;
  blogService: BlogService;
  activityLogService: ActivityLogService;
  octokit: Octokit;
}) {
  const { memberRepo, blogPostRepo, workspaceService, blogService, activityLogService, octokit } = deps;
  type BlogSyncSource = 'manual' | 'github-actions' | 'scheduler';
  type BlogSyncResult = { synced: number; deleted: number; failures: BlogSyncFailure[]; skipped?: boolean };
  type BlogSyncJob = {
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    source: BlogSyncSource;
    message: string;
    startedAt: Date;
    finishedAt: Date | null;
    progress: { total: number; processed: number; synced: number; percent: number; phase: string };
    result: BlogSyncResult | null;
    error: string | null;
  };

  const syncJobs = new Map<string, BlogSyncJob>();
  let runningJobId: string | null = null;

  const cleanupJobs = () => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [jobId, job] of syncJobs.entries()) {
      if (job.finishedAt && job.finishedAt.getTime() < cutoff) syncJobs.delete(jobId);
    }
  };

  const serializeJob = (job: BlogSyncJob) => ({
    id: job.id,
    status: job.status,
    source: job.source,
    message: job.message,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    progress: job.progress,
    result: job.result,
    error: job.error,
  });

  const runWorkspaceBlogSync = async (
    source: BlogSyncSource,
    onProgress?: (progress: BlogSyncJob['progress']) => void,
  ): Promise<BlogSyncResult> => {
    const workspace = await workspaceService.getOrThrow();
    const isAutomated = source === 'github-actions' || source === 'scheduler';
    const sourceLabel = source === 'scheduler' ? '스케줄러' : '자동';

    if (!workspace.blogSyncEnabled) {
      if (isAutomated) {
        await activityLogService.addLog('info', `${sourceLabel} 블로그 Sync 스킵 — blogSyncEnabled=false`);
      }
      onProgress?.({ total: 0, processed: 0, synced: 0, percent: 100, phase: '스킵됨' });
      return { synced: 0, deleted: 0, failures: [], skipped: true };
    }

    try {
      const result = await blogService.syncBlogs(workspace.id, onProgress);

      if (isAutomated) {
        await activityLogService.addLog(
          result.failures.length > 0 ? 'err' : 'ok',
          `${sourceLabel} 블로그 Sync 완료 — 수집 ${result.synced}건, 삭제 ${result.deleted}건, 실패 ${result.failures.length}건`,
        );

        for (const failure of result.failures.slice(0, 10)) {
          const target = failure.rssUrl ?? failure.blog;
          await activityLogService.addLog(
            'err',
            `  └ ${failure.githubId} ${failure.step}: ${target} — ${failure.error}`,
          );
        }
      }

      return result;
    } catch (error) {
      if (isAutomated) {
        const message = error instanceof Error ? error.message : String(error);
        await activityLogService.addLog('err', `${sourceLabel} 블로그 Sync 실패: ${message}`);
      }
      throw error;
    }
  };

  return {
    syncWorkspaceBlogs: async (source: BlogSyncSource = 'manual') => runWorkspaceBlogSync(source),

    enqueueWorkspaceBlogSync: async (source: BlogSyncSource = 'manual') => {
      cleanupJobs();
      if (runningJobId) {
        const runningJob = syncJobs.get(runningJobId);
        if (runningJob) return serializeJob(runningJob);
        runningJobId = null;
      }

      const job: BlogSyncJob = {
        id: randomUUID(),
        status: 'queued',
        source,
        message: '블로그 sync 대기 중',
        startedAt: new Date(),
        finishedAt: null,
        progress: { total: 0, processed: 0, synced: 0, percent: 0, phase: '대기 중' },
        result: null,
        error: null,
      };

      syncJobs.set(job.id, job);
      runningJobId = job.id;

      void Promise.resolve().then(async () => {
        job.status = 'running';
        job.message = '블로그 sync 실행 중';
        try {
          const result = await runWorkspaceBlogSync(source, (progress) => {
            job.progress = progress;
            job.message = `블로그 sync ${progress.phase} (${progress.processed}/${progress.total})`;
          });
          job.status = 'completed';
          job.message = result.skipped ? '블로그 sync 스킵됨' : '블로그 sync 완료';
          job.result = result;
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          job.status = 'failed';
          job.message = '블로그 sync 실패';
          job.error = detail;
        } finally {
          job.finishedAt = new Date();
          runningJobId = null;
          cleanupJobs();
        }
      });

      return serializeJob(job);
    },

    getBlogSyncJob: async (jobId: string) => {
      cleanupJobs();
      const job = syncJobs.get(jobId);
      if (!job) throw new HttpError(404, 'blog sync job not found');
      return serializeJob(job);
    },

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
  };
}
export type BlogAdminService = ReturnType<typeof createBlogAdminService>;
