import type { Octokit } from '@octokit/rest';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/index.js';
import type { SyncService } from '../sync/index.js';
import { parseCohorts } from '../../shared/cohort-regex.js';
import { discoverMissionRepos, fetchOrgRepos } from './repo-discovery.service.js';

export function createRepoService(deps: {
  missionRepoRepo: MissionRepoRepository;
  workspaceService: WorkspaceService;
  syncService: SyncService;
  octokit: Octokit;
}) {
  const { missionRepoRepo, workspaceService, syncService, octokit } = deps;
  type RepoSyncResult = { synced: number; failures: { prNumber: number; prUrl: string; error: string }[] };
  type RepoSyncProgress = { total: number; processed: number; synced: number; percent: number; phase: string };

  const toResponse = (repo: Awaited<ReturnType<MissionRepoRepository['findByIdOrThrow']>>) => ({
    ...repo,
    cohorts: parseCohorts(repo.cohorts),
  });

  return {
    listRepos: async (status?: string) => {
      const workspace = await workspaceService.getOrThrow();
      const repos = await missionRepoRepo.findMany({ workspaceId: workspace.id, ...(status ? { status } : {}) }, [
        { name: 'asc' },
      ]);
      return repos.map(toResponse);
    },

    createRepo: async (input: {
      githubRepoId?: number;
      name: string;
      repoUrl: string;
      description?: string | null;
      track: string | null;
      type?: string;
      tabCategory?: string;
      status?: string;
      syncMode?: string;
      candidateReason?: string | null;
      cohorts?: number[];
      level?: number | null;
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const repo = await missionRepoRepo.create({
        githubRepoId: input.githubRepoId ?? null,
        name: input.name,
        repoUrl: input.repoUrl,
        description: input.description ?? null,
        track: input.track,
        type: input.type ?? 'individual',
        tabCategory: input.tabCategory ?? (input.track === null ? 'common' : 'base'),
        status: input.status ?? 'active',
        syncMode: input.syncMode ?? 'continuous',
        candidateReason: input.candidateReason ?? null,
        ...(input.cohorts?.length ? { cohorts: JSON.stringify(input.cohorts) } : {}),
        workspaceId: workspace.id,
      });
      return toResponse(repo);
    },

    updateRepoMatchingRules: async (
      id: number,
      input: {
        description?: string | null;
        track?: string | null;
        type?: string;
        tabCategory?: string;
        status?: string;
        syncMode?: string;
        candidateReason?: string | null;
        cohorts?: number[] | null;
        level?: number | null;
      },
    ) => {
      const repo = await missionRepoRepo.update(id, {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.track !== undefined ? { track: input.track } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.tabCategory !== undefined ? { tabCategory: input.tabCategory } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.syncMode !== undefined ? { syncMode: input.syncMode } : {}),
        ...(input.candidateReason !== undefined ? { candidateReason: input.candidateReason } : {}),
        ...(input.cohorts !== undefined
          ? { cohorts: input.cohorts === null ? null : JSON.stringify(input.cohorts) }
          : {}),
      });
      return toResponse(repo);
    },

    executeRepoSync: async (id: number, onProgress?: (progress: RepoSyncProgress) => void): Promise<RepoSyncResult> => {
      const context = await workspaceService.getSyncContext();
      const repo = await missionRepoRepo.findByIdOrThrow(id);
      return syncService.syncRepo(
        octokit,
        context.id,
        context.githubOrg,
        { ...repo, lastSyncAt: null },
        context.cohortRules,
        onProgress,
      );
    },

    // 작업 목록에 보여 줄 레포 이름. 없는 레포여도 작업 등록은 지금처럼 받는다 (실행 시 실패로 기록)
    findRepoName: async (id: number): Promise<string | null> => {
      try {
        return (await missionRepoRepo.findByIdOrThrow(id)).name;
      } catch {
        return null;
      }
    },

    refreshRepoCandidates: async (): Promise<{ discovered: number; created: number; updated: number }> => {
      const workspace = await workspaceService.getOrThrow();
      const orgRepos = await fetchOrgRepos(octokit, workspace.githubOrg);
      const candidates = discoverMissionRepos(orgRepos);
      let created = 0;
      let updated = 0;

      for (const candidate of candidates) {
        const existing = await missionRepoRepo.findFirst({
          workspaceId: workspace.id,
          OR: [{ githubRepoId: candidate.githubRepoId }, { name: candidate.name }],
        });

        if (existing) {
          await missionRepoRepo.update(existing.id, {
            githubRepoId: candidate.githubRepoId,
            repoUrl: candidate.repoUrl,
            description: candidate.description,
            track: existing.track ?? candidate.track,
            type: existing.type || candidate.type,
            tabCategory: existing.tabCategory ?? candidate.tabCategory,
            candidateReason: candidate.candidateReason,
            ...(existing.status === 'active' ? {} : { status: candidate.status }),
          });
          updated += 1;
        } else {
          await missionRepoRepo.create({
            githubRepoId: candidate.githubRepoId,
            name: candidate.name,
            repoUrl: candidate.repoUrl,
            description: candidate.description,
            track: candidate.track,
            type: candidate.type,
            tabCategory: candidate.tabCategory,
            status: candidate.status,
            syncMode: 'once',
            candidateReason: candidate.candidateReason,
            workspaceId: workspace.id,
          });
          created += 1;
        }
      }

      return { discovered: candidates.length, created, updated };
    },

    resetRepoSyncStatus: async (id: number) => {
      await missionRepoRepo.update(id, { lastSyncAt: null });
    },

    deleteRepo: (id: number) => missionRepoRepo.deleteWithSubmissions(id),

    deleteAllRepos: async () => {
      const workspace = await workspaceService.getOrThrow();
      return missionRepoRepo.deleteAllWithSubmissions(workspace.id);
    },
  };
}

export type RepoService = ReturnType<typeof createRepoService>;
