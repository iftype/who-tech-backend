import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { BlogService } from './blog.service.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';
import { probeRss } from './blog.service.js';
import { fetchUserBlogCandidates } from '../sync/github.service.js';
import { mergePreviousGithubIds } from '../../shared/github-profile.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';
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

  return {
    syncWorkspaceBlogs: async (source?: 'manual' | 'github-actions' | 'scheduler') => {
      const workspace = await workspaceService.getOrThrow();
      const isAutomated = source === 'github-actions' || source === 'scheduler';
      const sourceLabel = source === 'scheduler' ? '스케줄러' : '자동';
      if (!workspace.blogSyncEnabled) {
        if (isAutomated) {
          await activityLogService.addLog('info', `${sourceLabel} 블로그 Sync 스킵 — blogSyncEnabled=false`);
        }
        return { synced: 0, deleted: 0, failures: [], skipped: true };
      }

      try {
        const result = await blogService.syncBlogs(workspace.id);

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
    },

    // 1. limit을 인자로 받긴 하되, 리포지토리에는 넘기지 않습니다.
    backfillWorkspaceBlogLinks: async (limit = 30, cohort?: number) => {
      const workspace = await workspaceService.getOrThrow();

      // 2. 리포지토리에는 limit을 빼고 호출하여 에러를 방지합니다.
      const allTargetMembers = await memberRepo.findWithFilters(workspace.id, {
        hasBlog: false,
        ...(cohort !== undefined ? { cohort } : {}),
      });

      // 3. 자바스크립트에서 요청받은 limit만큼만 자릅니다. (에러 원천 차단)
      const members = allTargetMembers.slice(0, limit);

      let updated = 0;
      let missing = 0;
      const failures: { githubId: string; reason: string }[] = [];

      for (const member of members) {
        try {
          // ... (이하 로직은 기존과 동일) ...
          const { profile, candidates } = await fetchUserBlogCandidates(octokit, {
            githubUserId: member.githubUserId,
            username: member.githubId,
          });

          let confirmedBlog: string | null = null;
          let confirmedRssUrl: string | null = null;

          for (const candidate of candidates) {
            if (!candidate) continue;
            try {
              const rssCheck = await probeRss(candidate);
              if (rssCheck.status === 'available') {
                confirmedBlog = candidate;
                confirmedRssUrl = rssCheck.rssUrl ?? null;
                break;
              }
            } catch {
              continue;
            }
          }

          const baseFields = {
            githubId: profile.githubId,
            githubUserId: profile.githubUserId,
            previousGithubIds: mergePreviousGithubIds(member.previousGithubIds, member.githubId, profile.githubId),
            avatarUrl: profile.avatarUrl,
            profileFetchedAt: new Date(),
            profileRefreshError: null,
          };

          if (confirmedBlog) {
            await memberRepo.patch(member.id, {
              ...baseFields,
              blog: confirmedBlog,
              rssStatus: 'available',
              rssUrl: confirmedRssUrl,
              rssCheckedAt: new Date(),
              rssError: null,
            });
            updated++;
          } else if (candidates.length > 0 && candidates[0]) {
            await memberRepo.patch(member.id, {
              ...baseFields,
              blog: candidates[0],
              rssStatus: 'unavailable',
              rssUrl: null,
              rssCheckedAt: new Date(),
              rssError: null,
            });
            updated++;
          } else {
            await memberRepo.patch(member.id, { ...baseFields });
            missing++;
          }
        } catch (error: unknown) {
          let reason = 'github_api_error';

          if (typeof error === 'object' && error !== null && 'status' in error) {
            reason = `github_api_${String((error as { status: number | string }).status)}`;
          }

          failures.push({ githubId: member.githubId, reason });
        }
      }

      return {
        checked: members.length,
        updated,
        missing,
        failed: failures.length,
        failures: failures.slice(0, 10),
      };
    },

    getNewPosts: async (sinceMinutes = 65) => {
      const workspace = await workspaceService.getOrThrow();
      const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
      const posts = await blogPostRepo.findSince(workspace.id, since);
      return posts.map((p) => {
        const cohortMap = new Map<number, string[]>();
        for (const mc of p.member.memberCohorts) {
          if (!cohortMap.has(mc.cohort.number)) cohortMap.set(mc.cohort.number, []);
          cohortMap.get(mc.cohort.number)!.push(mc.role.name);
        }
        const cohorts = [...cohortMap.entries()]
          .map(([cohort, roles]) => ({ cohort, roles }))
          .sort((a, b) => b.cohort - a.cohort);
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
