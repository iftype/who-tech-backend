import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';

export function createMemberPublicService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  cohortRepoRepo: CohortRepoRepository;
  workspaceService: WorkspaceService;
}) {
  const { memberRepo, blogPostRepo, cohortRepoRepo, workspaceService } = deps;

  function parseRoles(raw: string | null | undefined): string[] {
    if (!raw) return ['crew'];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : ['crew'];
    } catch {
      return ['crew'];
    }
  }

  return {
    searchMembers: async (filters?: { q?: string; cohort?: number; track?: string; role?: string }) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findWithFilters(workspace.id, filters);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return members.map((m: any) => {
        const targetCohort = filters?.cohort
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            m.memberCohorts.find((c: any) => c.cohort === filters.cohort)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [...m.memberCohorts].sort((a: any, b: any) => b.cohort - a.cohort)[0];

        return {
          githubId: m.githubId,
          nickname: resolveDisplayNickname(m.manualNickname, m.nicknameStats, m.nickname),
          avatarUrl: m.avatarUrl,
          cohort: targetCohort?.cohort ?? null,
          roles: parseRoles(targetCohort?.roles),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tracks: [...new Set(m.submissions.map((s: any) => s.missionRepo.track).filter((t: any) => t !== null))],
          blog: m.blog,
          lastPostedAt: m.lastPostedAt,
        };
      });
    },

    getMemberDetail: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findPublicDetail(githubId, workspace.id);
      if (!member) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nickname = resolveDisplayNickname(
        member.manualNickname,
        (member as any).nicknameStats,
        (member as any).nickname,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberCohorts = [...((member as any).memberCohorts || [])].sort((a: any, b: any) => b.cohort - a.cohort);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tracks = [
        ...new Set(member.submissions.map((s: any) => s.missionRepo.track).filter((t: any) => t !== null)),
      ];

      // 기수별 레포 순서 기반 아카이브 구성
      // missionRepoId별로 모든 submissions를 수집 (오래된 순 → step1, step2, ...)
      const submissionsByRepo = new Map<
        number,
        Array<{ prUrl: string; prNumber: number; title: string; submittedAt: Date }>
      >();
      for (const s of [...member.submissions].reverse()) {
        if (!submissionsByRepo.has(s.missionRepoId)) submissionsByRepo.set(s.missionRepoId, []);
        submissionsByRepo.get(s.missionRepoId)!.push({
          prUrl: s.prUrl,
          prNumber: s.prNumber,
          title: s.title,
          submittedAt: s.submittedAt,
        });
      }

      const archive: {
        cohort: number;
        levels: {
          level: number | null;
          repos: {
            name: string;
            track: string | null;
            tabCategory: string;
            submissions: Array<{ prUrl: string; prNumber: number; title: string; submittedAt: Date }> | null;
          }[];
        }[];
      }[] = [];

      for (const mc of memberCohorts) {
        const cohortRepos = await cohortRepoRepo.findByCohort(workspace.id, mc.cohort);
        if (cohortRepos.length === 0) continue;

        const levelMap = new Map<number | null, any[]>();
        for (const cr of cohortRepos) {
          const level = cr.missionRepo.level;
          if (!levelMap.has(level)) levelMap.set(level, []);
          levelMap.get(level)!.push({
            name: cr.missionRepo.name,
            track: cr.missionRepo.track,
            tabCategory: cr.missionRepo.tabCategory,
            submissions: submissionsByRepo.get(cr.missionRepoId) ?? null,
          });
        }

        const sortedLevels = [...levelMap.keys()].sort((a, b) => {
          if (a === null) return 1;
          if (b === null) return -1;
          return a - b;
        });

        const cohortArchive = {
          cohort: mc.cohort,
          levels: sortedLevels.map((level) => ({
            level,
            repos: levelMap.get(level)!,
          })),
        };
        archive.push(cohortArchive);
      }

      // CohortRepo 미등록 상태거나 submissions가 남았으면 fallback
      if (archive.length === 0 && member.submissions.length > 0) {
        const levelMap = new Map<number | null, any[]>();
        for (const s of [...member.submissions].reverse()) {
          const level = s.missionRepo.level;
          const name = s.missionRepo.name;
          if (!levelMap.has(level)) levelMap.set(level, []);
          const existing = levelMap.get(level)!.find((r) => r.name === name);
          const step = { prUrl: s.prUrl, prNumber: s.prNumber, title: s.title, submittedAt: s.submittedAt };
          if (existing) {
            existing.submissions!.push(step);
          } else {
            levelMap.get(level)!.push({
              name,
              track: s.missionRepo.track,
              tabCategory: s.missionRepo.tabCategory,
              submissions: [step],
            });
          }
        }
        const sortedLevels = [...levelMap.keys()].sort((a, b) => {
          if (a === null) return 1;
          if (b === null) return -1;
          return a - b;
        });
        const fallbackLevels = sortedLevels.map((level) => ({
          level,
          repos: levelMap.get(level)!,
        }));
        archive.push({ cohort: 0, levels: fallbackLevels });
      }

      return {
        githubId: member.githubId,
        nickname,
        avatarUrl: member.avatarUrl,
        cohorts: memberCohorts.map((mc: any) => ({
          cohort: mc.cohort,
          roles: parseRoles(mc.roles),
        })),
        tracks,
        blog: member.blog,
        lastPostedAt: member.lastPostedAt,
        archive,
        blogPosts: member.blogPostsLatest,
      };
    },

    getFeed: async (filters?: { cohort?: number; track?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workspace: any = await workspaceService.getOrThrow();
      const posts = await blogPostRepo.findFeed(workspace.id, filters);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return posts.map((p: any) => {
        const targetCohort = filters?.cohort
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            p.member.memberCohorts.find((c: any) => c.cohort === filters.cohort)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [...p.member.memberCohorts].sort((a: any, b: any) => b.cohort - a.cohort)[0];

        return {
          url: p.url,
          title: p.title,
          publishedAt: p.publishedAt,
          member: {
            githubId: p.member.githubId,
            nickname: resolveDisplayNickname(p.member.manualNickname, p.member.nicknameStats, p.member.nickname),
            avatarUrl: p.member.avatarUrl,
            cohort: targetCohort?.cohort ?? null,
            roles: parseRoles(targetCohort?.roles),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tracks: [
              ...new Set(p.member.submissions.map((s: any) => s.missionRepo.track).filter((t: any) => t !== null)),
            ],
          },
        };
      });
    },
  };
}

export type MemberPublicService = ReturnType<typeof createMemberPublicService>;
