import type { MemberRepository } from '../../db/repositories/member.repository.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import type { CohortRule } from '../../shared/types/index.js';
import { detectCohort } from '../sync/github.service.js';

// merged PR 기준으로 기수를 판별할 때의 최소 건수와 지배 비율
export const MIN_SUBMISSIONS = 3;
export const MIN_DOMINANCE = 0.5;

const isStaffRole = (role: string) => role === 'coach' || role === 'reviewer';

/**
 * merged 제출의 기수 분포에서 지배 기수(MIN_DOMINANCE 이상)를 찾아 크루 참여 기수를 그 기수 하나로 맞춘다.
 * 코치·리뷰어 기수는 건드리지 않는다. 판별 기준을 못 넘으면 아무것도 바꾸지 않는다.
 */
export async function applyDominantCohort(params: {
  memberId: number;
  memberCohorts: Parameters<typeof buildCohortList>[0];
  submissions: { status: string; submittedAt: Date | string }[];
  cohortRules: CohortRule[];
  memberRepo: Pick<MemberRepository, 'deleteParticipationsByCohort' | 'upsertParticipation'>;
}): Promise<void> {
  const { memberId, memberCohorts, submissions, cohortRules, memberRepo } = params;

  const mergedSubmissions = submissions.filter((s) => s.status === 'merged');
  if (mergedSubmissions.length < MIN_SUBMISSIONS) return;

  const cohortFreq = new Map<number, number>();
  for (const sub of mergedSubmissions) {
    const cohort = detectCohort(new Date(sub.submittedAt), cohortRules);
    if (cohort != null) {
      cohortFreq.set(cohort, (cohortFreq.get(cohort) ?? 0) + 1);
    }
  }

  const totalWithCohort = [...cohortFreq.values()].reduce((sum, c) => sum + c, 0);
  if (totalWithCohort < MIN_SUBMISSIONS) return;

  const [dominantCohort, dominantCount] = [...cohortFreq.entries()].sort((a, b) => b[1] - a[1])[0]!;
  if (dominantCount / totalWithCohort < MIN_DOMINANCE) return;

  const currentCohorts = buildCohortList(memberCohorts);

  for (const current of currentCohorts) {
    if (current.roles.some(isStaffRole)) continue;
    if (!cohortFreq.has(current.cohort)) {
      await memberRepo.deleteParticipationsByCohort(memberId, current.cohort);
    }
  }

  const remainingCrewCohorts = currentCohorts.filter((c) => !c.roles.some(isStaffRole));

  for (const c of remainingCrewCohorts) {
    if (c.cohort !== dominantCohort) {
      await memberRepo.deleteParticipationsByCohort(memberId, c.cohort);
    }
  }

  if (!remainingCrewCohorts.some((c) => c.cohort === dominantCohort)) {
    await memberRepo.upsertParticipation(memberId, dominantCohort, 'crew');
  }
}
