import type { MemberDetailWithRelations } from '../../db/repositories/member.repository.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { resolveDisplayNickname, parseNicknameStats } from '../../shared/nickname.js';
import { summarizeTracks } from '../../shared/member-track.js';

export function toMemberResponse(member: MemberDetailWithRelations) {
  const cohorts = buildCohortList(member.memberCohorts);
  const primaryCohort = cohorts[0];
  const { track, tracks } = summarizeTracks(member.track, member.submissions);

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
    track,
    tracks,
    blogPosts: member.blogPosts,
    submissions: member.submissions,
    _count: member._count,
  };
}
