import { Octokit } from '@octokit/rest';
import type { CohortRule } from '../types/index.js';

const EXCLUDED_BRANCHES = new Set(['main', 'master', 'develop', 'step1', 'step2', 'step3']);

export function parseNickname(title: string, regex: RegExp): string | null {
  return title.match(regex)?.[1]?.trim() ?? null;
}

export function detectCohort(submittedAt: Date, cohortRules: CohortRule[]): number | null {
  const year = submittedAt.getFullYear();
  return cohortRules.find((rule) => rule.year === year)?.cohort ?? null;
}

export function isMissionRepo(prs: { base: { ref: string }; user: { login: string } }[]): boolean {
  return prs.some((pr) => {
    const base = pr.base.ref.toLowerCase();
    return !EXCLUDED_BRANCHES.has(base) && base === pr.user.login.toLowerCase();
  });
}

export function createOctokit(token?: string): Octokit {
  return new Octokit({ auth: token });
}

export async function fetchRepoPRs(
  octokit: Octokit,
  org: string,
  repo: string,
  perPage = 100,
): Promise<Awaited<ReturnType<typeof octokit.pulls.list>>['data']> {
  const allPRs = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner: org,
      repo,
      state: 'all',
      per_page: perPage,
      page,
    });

    allPRs.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return allPRs;
}

export async function fetchOrgRepos(
  octokit: Octokit,
  org: string,
): Promise<Awaited<ReturnType<typeof octokit.repos.listForOrg>>['data']> {
  const allRepos = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.repos.listForOrg({
      org,
      type: 'public',
      per_page: 100,
      page,
    });

    allRepos.push(...data);

    if (data.length < 100) break;
    page++;
  }

  return allRepos;
}
