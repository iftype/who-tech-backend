import prisma from '../../db/prisma.js';
import { parseCohortRegexRules, stringifyCohortRegexRules } from '../../shared/cohort-regex.js';
import type { CohortRegexRule } from '../../shared/types/index.js';
import { createOctokit } from '../sync/github.service.js';
import { discoverMissionRepos, fetchOrgRepos } from './repo-discovery.service.js';
import { syncRepo } from '../sync/sync.service.js';
import { getWorkspaceOrThrow, getWorkspaceSyncContext } from '../workspace/workspace.service.js';

export async function listRepos(status?: string) {
  const workspace = await getWorkspaceOrThrow();

  const repos = await prisma.missionRepo.findMany({
    where: {
      workspaceId: workspace.id,
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });

  return repos.map(toRepoResponse);
}

export async function createRepo(input: {
  githubRepoId?: number;
  name: string;
  repoUrl: string;
  description?: string | null;
  track: string;
  type?: string;
  status?: string;
  candidateReason?: string | null;
  nicknameRegex?: string;
  cohortRegexRules?: CohortRegexRule[];
}) {
  const workspace = await getWorkspaceOrThrow();

  const repo = await prisma.missionRepo.create({
    data: {
      githubRepoId: input.githubRepoId ?? null,
      name: input.name,
      repoUrl: input.repoUrl,
      description: input.description ?? null,
      track: input.track,
      type: input.type ?? 'individual',
      status: input.status ?? 'active',
      candidateReason: input.candidateReason ?? null,
      nicknameRegex: input.nicknameRegex ?? null,
      cohortRegexRules: stringifyCohortRegexRules(input.cohortRegexRules),
      workspaceId: workspace.id,
    },
  });

  return toRepoResponse(repo);
}

export async function updateRepoMatchingRules(
  id: number,
  input: {
    description?: string | null;
    track?: string;
    type?: string;
    status?: string;
    candidateReason?: string | null;
    nicknameRegex?: string | null;
    cohortRegexRules?: CohortRegexRule[] | null;
  },
) {
  const repo = await prisma.missionRepo.update({
    where: { id },
    data: {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.track !== undefined ? { track: input.track } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.candidateReason !== undefined ? { candidateReason: input.candidateReason } : {}),
      ...(input.nicknameRegex !== undefined ? { nicknameRegex: input.nicknameRegex } : {}),
      ...(input.cohortRegexRules !== undefined
        ? { cohortRegexRules: stringifyCohortRegexRules(input.cohortRegexRules) }
        : {}),
    },
  });

  return toRepoResponse(repo);
}

export async function syncRepoById(id: number): Promise<{ synced: number }> {
  const context = await getWorkspaceSyncContext();
  const repo = await prisma.missionRepo.findUniqueOrThrow({ where: { id } });
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  return syncRepo(octokit, context.id, context.githubOrg, repo, context.workspaceRegex, context.cohortRules);
}

export async function refreshRepoCandidates(): Promise<{
  discovered: number;
  created: number;
  updated: number;
}> {
  const workspace = await getWorkspaceOrThrow();
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);
  const orgRepos = await fetchOrgRepos(octokit, workspace.githubOrg);
  const candidates = discoverMissionRepos(orgRepos);

  let created = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const existing = await prisma.missionRepo.findFirst({
      where: {
        workspaceId: workspace.id,
        OR: [{ githubRepoId: candidate.githubRepoId }, { name: candidate.name }],
      },
    });

    if (existing) {
      await prisma.missionRepo.update({
        where: { id: existing.id },
        data: {
          githubRepoId: candidate.githubRepoId,
          repoUrl: candidate.repoUrl,
          description: candidate.description,
          track: existing.track || candidate.track,
          type: existing.type || candidate.type,
          candidateReason: candidate.candidateReason,
          ...(existing.status === 'excluded' ? {} : { status: existing.status }),
        },
      });
      updated += 1;
      continue;
    }

    await prisma.missionRepo.create({
      data: {
        githubRepoId: candidate.githubRepoId,
        name: candidate.name,
        repoUrl: candidate.repoUrl,
        description: candidate.description,
        track: candidate.track,
        type: candidate.type,
        status: 'candidate',
        candidateReason: candidate.candidateReason,
        workspaceId: workspace.id,
      },
    });
    created += 1;
  }

  return { discovered: candidates.length, created, updated };
}

export async function deleteRepo(id: number): Promise<void> {
  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { missionRepoId: id } }),
    prisma.missionRepo.delete({ where: { id } }),
  ]);
}

function toRepoResponse(repo: {
  id: number;
  githubRepoId: number | null;
  name: string;
  repoUrl: string;
  description: string | null;
  track: string;
  type: string;
  status: string;
  candidateReason: string | null;
  nicknameRegex: string | null;
  cohortRegexRules: string | null;
  workspaceId: number;
}) {
  return {
    ...repo,
    cohortRegexRules: parseCohortRegexRules(repo.cohortRegexRules),
  };
}
