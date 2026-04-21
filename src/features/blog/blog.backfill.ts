import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import { mergePreviousGithubIds } from '../../shared/github-profile.js';
import { fetchUserBlogCandidates } from '../sync/github.service.js';
import { probeRss } from './blog.rss.js';

export async function backfillMemberBlogLinks(
  memberRepo: MemberRepository,
  octokit: Octokit,
  workspaceId: number,
  limit = 30,
  cohort?: number,
) {
  const allTargetMembers = await memberRepo.findWithFilters(workspaceId, {
    hasBlog: false,
    ...(cohort !== undefined ? { cohort } : {}),
  });

  const members = allTargetMembers.slice(0, limit);
  let updated = 0;
  let missing = 0;
  const failures: { githubId: string; reason: string }[] = [];

  for (const member of members) {
    try {
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

  return { checked: members.length, updated, missing, failed: failures.length, failures: failures.slice(0, 10) };
}
