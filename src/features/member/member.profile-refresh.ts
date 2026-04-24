import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import { mergePreviousGithubIds } from '../../shared/github-profile.js';
import { resolveDisplayNickname, extractNicknameTokens, mergeNicknameStat } from '../../shared/nickname.js';
import { fetchUserBlogCandidates, detectCohort } from '../sync/github.service.js';
import { probeRss } from '../blog/blog.rss.js';
import { toMemberResponse } from './member.response.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import type { CohortRule } from '../../shared/types/index.js';

const MIN_SUBMISSIONS = 3;
const MIN_DOMINANCE = 0.5;

export async function refreshMemberProfileById(
  id: number,
  bannedWords: Set<string>,
  fetchGithub: boolean,
  memberRepo: MemberRepository,
  octokit: Octokit,
  cohortRules?: CohortRule[],
) {
  const member = await memberRepo.findByIdWithRelations(id);
  if (!member) throw new Error('member not found');

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
    let profileFields: {
      githubId: string;
      githubUserId: number | null;
      previousGithubIds: string | null;
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
      profileFields = {
        githubId: profile.githubId,
        githubUserId: profile.githubUserId,
        previousGithubIds: mergePreviousGithubIds(member.previousGithubIds, member.githubId, profile.githubId),
        avatarUrl: profile.avatarUrl ?? member.avatarUrl ?? null,
        blog: resolvedBlog ?? member.blog ?? null,
      };
    } catch (error) {
      profileFields = {
        githubId: member.githubId,
        githubUserId: member.githubUserId ?? null,
        previousGithubIds: member.previousGithubIds ?? null,
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
  }

  if (cohortRules && !updated.cohortLocked && updated.submissions.length >= MIN_SUBMISSIONS) {
    const cohortFreq = new Map<number, number>();
    for (const sub of updated.submissions) {
      const cohort = detectCohort(new Date(sub.submittedAt), cohortRules);
      if (cohort != null) {
        cohortFreq.set(cohort, (cohortFreq.get(cohort) ?? 0) + 1);
      }
    }

    const totalWithCohort = [...cohortFreq.values()].reduce((sum, c) => sum + c, 0);
    if (totalWithCohort >= MIN_SUBMISSIONS) {
      const sorted = [...cohortFreq.entries()].sort((a, b) => b[1] - a[1]);
      const [dominantCohort, dominantCount] = sorted[0]!;
      const dominanceRatio = dominantCount / totalWithCohort;

      if (dominanceRatio >= MIN_DOMINANCE) {
        const currentCohorts = buildCohortList(updated.memberCohorts);

        for (const current of currentCohorts) {
          const isStaff = current.roles.some((r) => r === 'coach' || r === 'reviewer');
          if (isStaff) continue;
          if (!cohortFreq.has(current.cohort)) {
            await memberRepo.deleteParticipationsByCohort(id, current.cohort);
          }
        }

        const remainingCrewCohorts = currentCohorts.filter(
          (c) => !c.roles.some((r) => r === 'coach' || r === 'reviewer'),
        );

        for (const c of remainingCrewCohorts) {
          if (c.cohort !== dominantCohort) {
            await memberRepo.deleteParticipationsByCohort(id, c.cohort);
          }
        }

        if (!remainingCrewCohorts.some((c) => c.cohort === dominantCohort)) {
          await memberRepo.upsertParticipation(id, dominantCohort, 'crew');
        }
      }
    }
  }

  return toMemberResponse(updated);
}
