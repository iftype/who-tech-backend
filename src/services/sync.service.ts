import type { Octokit } from '@octokit/rest';
import prisma from '../db/prisma.js';
import { fetchRepoPRs, parseNickname, detectCohort } from './github.service.js';
import type { CohortRule, ParsedSubmission } from '../types/index.js';

type RawPR = {
  number: number;
  html_url: string;
  title: string;
  user: { login: string } | null;
  base: { ref: string };
  created_at: string;
};

export function parsePRsToSubmissions(
  prs: RawPR[],
  nicknameRegex: RegExp,
  cohortRules: CohortRule[],
): ParsedSubmission[] {
  const results: ParsedSubmission[] = [];

  for (const pr of prs) {
    if (!pr.user) continue;

    const nickname = parseNickname(pr.title, nicknameRegex);
    if (!nickname) continue;

    const submittedAt = new Date(pr.created_at);
    const cohort = detectCohort(submittedAt, cohortRules);

    results.push({
      githubId: pr.user.login,
      nickname,
      prNumber: pr.number,
      prUrl: pr.html_url,
      title: pr.title,
      submittedAt,
      cohort,
    });
  }

  return results;
}

export async function syncRepo(
  octokit: Octokit,
  workspaceId: number,
  org: string,
  repo: { id: number; name: string },
  nicknameRegex: RegExp,
  cohortRules: CohortRule[],
): Promise<{ synced: number }> {
  const prs = await fetchRepoPRs(octokit, org, repo.name);
  const submissions = parsePRsToSubmissions(prs, nicknameRegex, cohortRules);

  let synced = 0;

  for (const s of submissions) {
    const member = await prisma.member.upsert({
      where: { githubId_workspaceId: { githubId: s.githubId, workspaceId } },
      create: { githubId: s.githubId, nickname: s.nickname, cohort: s.cohort, workspaceId },
      update: { nickname: s.nickname, cohort: s.cohort },
    });

    await prisma.submission.upsert({
      where: { prNumber_missionRepoId: { prNumber: s.prNumber, missionRepoId: repo.id } },
      create: {
        prNumber: s.prNumber,
        prUrl: s.prUrl,
        title: s.title,
        submittedAt: s.submittedAt,
        memberId: member.id,
        missionRepoId: repo.id,
      },
      update: {},
    });

    synced++;
  }

  return { synced };
}

export async function syncWorkspace(
  octokit: Octokit,
  workspaceId: number,
): Promise<{ totalSynced: number; reposSynced: number }> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
  const workspaceRegex = new RegExp(workspace.nicknameRegex);

  const repos = await prisma.missionRepo.findMany({ where: { workspaceId } });

  let totalSynced = 0;

  for (const repo of repos) {
    const nicknameRegex = repo.nicknameRegex ? new RegExp(repo.nicknameRegex) : workspaceRegex;

    const { synced } = await syncRepo(octokit, workspaceId, workspace.githubOrg, repo, nicknameRegex, cohortRules);

    totalSynced += synced;
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {},
  });

  return { totalSynced, reposSynced: repos.length };
}
