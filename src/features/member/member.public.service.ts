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
      return members.map((m) => ({
        githubId: m.githubId,
        nickname: resolveDisplayNickname(m.manualNickname, m.nicknameStats, m.nickname),
        avatarUrl: m.avatarUrl,
        cohort: m.cohort,
        roles: parseRoles(m.roles),
        tracks: [...new Set(m.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
      }));
    },

    getMemberDetail: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findPublicDetail(githubId, workspace.id);
      if (!member) return null;

      const nickname = resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname);
      const roles = parseRoles(member.roles);
      const tracks = [...new Set(member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))];

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
        level: number | null;
        repos: {
          name: string;
          track: string | null;
          tabCategory: string;
          submissions: Array<{ prUrl: string; prNumber: number; title: string; submittedAt: Date }> | null;
        }[];
      }[] = [];

      if (member.cohort) {
        const cohortRepos = await cohortRepoRepo.findByCohort(workspace.id, member.cohort);
        const levelMap = new Map<number | null, (typeof archive)[number]['repos']>();

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

        // level 오름차순, null은 마지막
        const sortedLevels = [...levelMap.keys()].sort((a, b) => {
          if (a === null) return 1;
          if (b === null) return -1;
          return a - b;
        });
        for (const level of sortedLevels) {
          archive.push({ level, repos: levelMap.get(level)! });
        }
      }

      // CohortRepo 미등록 상태면 raw submissions 기반 fallback archive 생성
      if (archive.length === 0 && member.submissions.length > 0) {
        const levelMap = new Map<number | null, (typeof archive)[number]['repos']>();
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
        for (const level of sortedLevels) {
          archive.push({ level, repos: levelMap.get(level)! });
        }
      }

      return {
        githubId: member.githubId,
        nickname,
        avatarUrl: member.avatarUrl,
        cohort: member.cohort,
        roles,
        tracks,
        blog: member.blog,
        lastPostedAt: member.lastPostedAt,
        archive,
        blogPosts: member.blogPostsLatest,
      };
    },

    getFeed: async (filters?: { cohort?: number; track?: string }) => {
      const workspace = await workspaceService.getOrThrow();
      const posts = await blogPostRepo.findFeed(workspace.id, filters);
      return posts.map((p) => ({
        url: p.url,
        title: p.title,
        publishedAt: p.publishedAt,
        member: {
          githubId: p.member.githubId,
          nickname: resolveDisplayNickname(p.member.manualNickname, p.member.nicknameStats, p.member.nickname),
          avatarUrl: p.member.avatarUrl,
          cohort: p.member.cohort,
          roles: JSON.parse((p.member.roles as string) || '["crew"]') as string[],
          tracks: [...new Set(p.member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
        },
      }));
    },
  };
}

export type MemberPublicService = ReturnType<typeof createMemberPublicService>;
