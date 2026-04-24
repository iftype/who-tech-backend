import type { MemberWithRelations } from '../../db/repositories/member.repository.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { resolveDisplayNickname, parseNicknameStats } from '../../shared/nickname.js';

export function toMemberResponse(member: MemberWithRelations) {
  const cohorts = buildCohortList(member.memberCohorts);
  const primaryCohort = cohorts[0];

  return {
    id: member.id,
    githubId: member.githubId,
    githubUserId: member.githubUserId,
    nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
    manualNickname: member.manualNickname,
    nicknameStats: parseNicknameStats(member.nicknameStats),
    avatarUrl: member.avatarUrl,
    blog: member.blog,
    lastPostedAt: member.lastPostedAt,
    profileFetchedAt: member.profileFetchedAt,
    profileRefreshError: member.profileRefreshError,
    rssStatus: member.rssStatus,
    rssUrl: member.rssUrl,
    rssCheckedAt: member.rssCheckedAt,
    rssError: member.rssError,
    cohorts,
    cohort: primaryCohort?.cohort ?? null,
    roles: primaryCohort?.roles ?? ['crew'],
    cohortLocked: member.cohortLocked,
    track: member.track ?? null,
    tracks: [
      ...new Set([
        ...(member.track ? [member.track] : []),
        ...member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null),
      ]),
    ],
    blogPosts: member.blogPosts,
    submissions: member.submissions,
    _count: member._count,
  };
}
