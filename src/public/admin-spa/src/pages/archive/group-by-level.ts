import type { CohortRepo } from '../../lib/types.js';

// 레벨별로 묶고 레벨 오름차순, 레벨 없는 레포(미분류)는 맨 뒤
export function groupCohortReposByLevel(repos: CohortRepo[]) {
  const map = new Map<number | null, CohortRepo[]>();
  for (const cr of repos) {
    const level = cr.level ?? null;
    if (!map.has(level)) map.set(level, []);
    map.get(level)!.push(cr);
  }
  const sortedLevels = [...map.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });
  return sortedLevels.map((level) => ({ level, repos: map.get(level)! }));
}
