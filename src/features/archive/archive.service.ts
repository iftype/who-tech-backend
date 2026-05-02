import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';

export function createArchiveService(deps: {
  memberRepo: MemberRepository;
  cohortRepoRepo: CohortRepoRepository;
  workspaceService: WorkspaceService;
}) {
  const { memberRepo, cohortRepoRepo, workspaceService } = deps;

  return {
    generateCohortMarkdown: async (cohort: number, track?: string): Promise<{ markdown: string }> => {
      const workspace = await workspaceService.getOrThrow();

      const allCohortRepos = await cohortRepoRepo.findByCohort(workspace.id, cohort);
      const cohortRepos = track ? allCohortRepos.filter((cr) => cr.missionRepo.track === track) : allCohortRepos;

      if (cohortRepos.length === 0) {
        return { markdown: `# ${cohort}기 아카이브\n\n등록된 레포가 없습니다.\n` };
      }

      const levelMap = new Map<number | null, typeof cohortRepos>();
      for (const cr of cohortRepos) {
        const level = cr.level;
        if (!levelMap.has(level)) levelMap.set(level, []);
        levelMap.get(level)!.push(cr);
      }

      const sortedLevels = [...levelMap.keys()].sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a - b;
      });

      // 해당 기수 멤버 + 제출 내역 조회
      const members = await memberRepo.findWithFilters(workspace.id, {
        cohort,
        ...(track ? { track } : {}),
      });

      // 멤버별 제출 인덱스: memberId → missionRepoId → { prUrl, prNumber }
      // 역순으로 돌려 가장 오래된(첫 번째) PR을 덮어쓰게 함
      const submissionMap = new Map<number, Map<number, { prUrl: string; prNumber: number }>>();
      for (const m of members) {
        const byRepo = new Map<number, { prUrl: string; prNumber: number }>();
        for (const s of [...m.submissions].reverse()) {
          byRepo.set(s.missionRepoId, { prUrl: s.prUrl, prNumber: s.prNumber });
        }
        submissionMap.set(m.id, byRepo);
      }

      // 닉네임 기준 정렬
      const sortedMembers = [...members].sort((a, b) => {
        const na = resolveDisplayNickname(a.manualNickname, a.nicknameStats, a.nickname) ?? a.githubId;
        const nb = resolveDisplayNickname(b.manualNickname, b.nicknameStats, b.nickname) ?? b.githubId;
        return na.localeCompare(nb, 'ko');
      });

      // 마크다운 생성
      const lines: string[] = [`# ${cohort}기 아카이브${track ? ` (${track})` : ''}\n`];

      for (const level of sortedLevels) {
        const repos = levelMap.get(level)!;
        lines.push(level !== null ? `## 레벨 ${level}` : '## 미분류');
        lines.push('');

        const repoNames = repos.map((cr) => cr.missionRepo.name);
        lines.push(`| 닉네임 | ${repoNames.join(' | ')} |`);
        lines.push(`|--------|${repoNames.map(() => ':---:').join('|')}|`);

        for (const m of sortedMembers) {
          const nickname = resolveDisplayNickname(m.manualNickname, m.nicknameStats, m.nickname) ?? m.githubId;
          const byRepo = submissionMap.get(m.id);
          const cells = repos.map((cr) => {
            const sub = byRepo?.get(cr.missionRepoId);
            return sub ? `[#${sub.prNumber}](${sub.prUrl})` : '-';
          });
          lines.push(`| ${nickname} | ${cells.join(' | ')} |`);
        }
        lines.push('');
      }

      return { markdown: lines.join('\n') };
    },
  };
}

export type ArchiveService = ReturnType<typeof createArchiveService>;
