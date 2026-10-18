// 멤버 상세의 미션 아카이브 구성: 크루로 참여한 기수별 레포를 레벨 순으로, 기수에 등록되지 않은 제출은 cohort 0으로 묶는다

export interface ArchiveSubmission {
  prUrl: string;
  prNumber: number;
  title: string;
  status: string;
  submittedAt: Date;
}

export interface ArchiveRepo {
  name: string;
  track: string | null;
  tabCategory: string;
  submissions: ArchiveSubmission[] | null;
}

export interface CohortArchive {
  cohort: number;
  levels: { level: number | null; repos: ArchiveRepo[] }[];
}

type RepoInfo = { name: string; track: string | null; tabCategory: string };

type MemberSubmission = ArchiveSubmission & { missionRepoId: number; missionRepo: RepoInfo };

type CohortRepoRow = { missionRepoId: number; level: number | null; missionRepo: RepoInfo };

/** 이름에 precourse가 들어가거나 precourse로 분류된 레포는 프리코스 탭 */
export function resolveTabCategory(repo: { name: string; tabCategory: string }): string {
  if (repo.name.toLowerCase().includes('precourse')) return 'precourse';
  if (repo.tabCategory === 'precourse') return 'precourse';
  return repo.tabCategory;
}

/** 레벨 오름차순, 레벨 없음(null)은 마지막 */
function compareLevel(a: number | null, b: number | null): number {
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export async function buildMemberArchive(params: {
  cohorts: { cohort: number; roles: string[] }[];
  // repository가 최신순으로 돌려주는 제출 목록
  submissions: MemberSubmission[];
  loadCohortRepos: (cohort: number) => Promise<CohortRepoRow[]>;
}): Promise<CohortArchive[]> {
  const { cohorts, submissions, loadCohortRepos } = params;

  // 레포별 제출을 오래된 순으로
  const submissionsByRepo = new Map<number, ArchiveSubmission[]>();
  for (const s of [...submissions].reverse()) {
    if (!submissionsByRepo.has(s.missionRepoId)) submissionsByRepo.set(s.missionRepoId, []);
    submissionsByRepo.get(s.missionRepoId)!.push({
      prUrl: s.prUrl,
      prNumber: s.prNumber,
      title: s.title,
      status: s.status,
      submittedAt: s.submittedAt,
    });
  }

  const archive: CohortArchive[] = [];
  const processedRepoIds = new Set<number>();

  // 코치·리뷰어로 참여한 기수는 아카이브 대상이 아니다
  const crewOnlyCohorts = cohorts.filter(
    (c) => c.roles.includes('crew') && !c.roles.some((r) => r === 'coach' || r === 'reviewer'),
  );

  for (const { cohort } of crewOnlyCohorts) {
    const cohortRepos = await loadCohortRepos(cohort);
    if (cohortRepos.length === 0) continue;

    const levelMap = new Map<number | null, ArchiveRepo[]>();
    for (const cr of cohortRepos) {
      processedRepoIds.add(cr.missionRepoId);
      if (!levelMap.has(cr.level)) levelMap.set(cr.level, []);
      levelMap.get(cr.level)!.push({
        name: cr.missionRepo.name,
        track: cr.missionRepo.track,
        tabCategory: resolveTabCategory(cr.missionRepo),
        submissions: submissionsByRepo.get(cr.missionRepoId) ?? null,
      });
    }

    archive.push({
      cohort,
      levels: [...levelMap.keys()].sort(compareLevel).map((level) => ({ level, repos: levelMap.get(level)! })),
    });
  }

  const unregisteredRepos = new Map<number, ArchiveRepo>();
  for (const s of submissions) {
    if (processedRepoIds.has(s.missionRepoId) || unregisteredRepos.has(s.missionRepoId)) continue;
    unregisteredRepos.set(s.missionRepoId, {
      name: s.missionRepo.name,
      track: s.missionRepo.track,
      tabCategory: resolveTabCategory(s.missionRepo),
      submissions: submissionsByRepo.get(s.missionRepoId) ?? null,
    });
  }

  if (unregisteredRepos.size > 0) {
    archive.push({ cohort: 0, levels: [{ level: null, repos: [...unregisteredRepos.values()] }] });
  }

  return archive;
}
