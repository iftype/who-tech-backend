import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import { mergePreviousGithubIds } from '../../shared/github-profile.js';
import { resolveDisplayNickname, extractNicknameTokens, mergeNicknameStat } from '../../shared/nickname.js';
import { fetchUserBlogCandidates } from '../../infra/github/github.client.js';
import { probeRss } from '../../infra/rss/rss.js';
import { toMemberResponse } from './member.response.js';
import { applyDominantCohort } from './member.cohort-recalc.js';
import { computeDominantTrack } from '../../shared/member-track.js';
import type { CohortRule } from '../../shared/types/index.js';
import { NotFoundError } from '../../shared/errors.js';

export async function refreshMemberProfileById(
  id: number,
  bannedWords: Set<string>,
  fetchGithub: boolean,
  memberRepo: MemberRepository,
  octokit: Octokit,
  cohortRules?: CohortRule[],
) {
  const member = await memberRepo.findByIdWithRelations(id);
  if (!member) throw new NotFoundError('member not found');

  let statsValue: string | null = null;
  for (const submission of member.submissions) {
    for (const token of extractNicknameTokens(submission.title)) {
      if (!bannedWords.has(token)) {
        statsValue = JSON.stringify(mergeNicknameStat(statsValue, token, submission.submittedAt));
      }
    }
  }

  const resolvedNickname = resolveDisplayNickname(member.manualNickname, statsValue, null);

  let updated: Awaited<ReturnType<MemberRepository['update']>>;
  let profileRefreshError: string | null = null;

  if (!fetchGithub) {
    updated = await memberRepo.update(id, { nicknameStats: statsValue, nickname: resolvedNickname });
  } else {
    const previousIds = await memberRepo.findPreviousGithubIds(id);
    // GitHub에서 새 프로필을 받았을 때만 이전 ID가 바뀐다
    let nextPreviousIds: string[] | null = null;
    let profileFields: {
      githubId: string;
      githubUserId: number | null;
      avatarUrl: string | null;
      blog?: string | null;
    };

    try {
      const { profile, candidates } = await fetchUserBlogCandidates(octokit, {
        githubUserId: member.githubUserId,
        username: member.githubId,
      });
      let validBlog: string | null = null;
      for (const url of candidates) {
        const rssCheck = await probeRss(url);
        if (rssCheck.status === 'available') {
          validBlog = url;
          break;
        }
      }
      const resolvedBlog = validBlog ?? candidates[0] ?? null;
      nextPreviousIds = mergePreviousGithubIds(previousIds, member.githubId, profile.githubId);
      profileFields = {
        githubId: profile.githubId,
        githubUserId: profile.githubUserId,
        avatarUrl: profile.avatarUrl ?? member.avatarUrl ?? null,
        blog: resolvedBlog ?? member.blog ?? null,
      };
    } catch (error) {
      profileFields = {
        githubId: member.githubId,
        githubUserId: member.githubUserId ?? null,
        avatarUrl: member.avatarUrl ?? null,
      };
      profileRefreshError = error instanceof Error ? error.message : String(error);
    }

    updated = await memberRepo.update(id, {
      ...profileFields,
      nicknameStats: statsValue,
      nickname: resolvedNickname,
      profileFetchedAt: new Date(),
      profileRefreshError,
    });
    if (nextPreviousIds) await memberRepo.replacePreviousGithubIds(id, nextPreviousIds);
  }

  const dominantTrack = computeDominantTrack(updated.submissions);
  if (dominantTrack !== member.track) {
    updated = await memberRepo.update(id, { track: dominantTrack });
  }

  if (cohortRules && !updated.cohortLocked) {
    await applyDominantCohort({
      memberId: id,
      memberCohorts: updated.memberCohorts,
      submissions: updated.submissions,
      cohortRules,
      memberRepo,
    });
  }

  return toMemberResponse(updated);
}
