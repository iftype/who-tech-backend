/** MemberCohort 배열에서 기수별 역할 목록을 구성 (기수 내림차순) */
export function buildCohortList(
  memberCohorts: { cohort: { number: number }; role: { name: string } }[],
): { cohort: number; roles: string[] }[] {
  const cohortMap = new Map<number, string[]>();
  for (const mc of memberCohorts) {
    if (!cohortMap.has(mc.cohort.number)) cohortMap.set(mc.cohort.number, []);
    cohortMap.get(mc.cohort.number)!.push(mc.role.name);
  }
  return [...cohortMap.entries()].map(([cohort, roles]) => ({ cohort, roles })).sort((a, b) => b.cohort - a.cohort);
}
