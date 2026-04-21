import { extractNicknameTokens } from '../../shared/nickname.js';
import { detectCohort } from './github.service.js';
import type { CohortRule, ParsedSubmission, PrStatus } from '../../shared/types/index.js';

export type RawPR = {
  number: number;
  html_url: string;
  title: string;
  state: string;
  merged_at: string | null;
  user: { login: string; id?: number } | null;
  base: { ref: string };
  created_at: string;
};

function resolvePrStatus(state: string, merged_at: string | null): PrStatus {
  if (state === 'open') return 'open';
  return merged_at ? 'merged' : 'closed';
}

export function parsePRsToSubmissions(prs: RawPR[], cohortRules: CohortRule[]): ParsedSubmission[] {
  const results: ParsedSubmission[] = [];

  for (const pr of prs) {
    if (!pr.user) continue;
    // GitHub 탈퇴 계정은 login이 "ghost"로 변경되므로 건너뜀
    if (pr.user.login === 'ghost') continue;

    const submittedAt = new Date(pr.created_at);
    const cohort = detectCohort(submittedAt, cohortRules);
    const nicknameTokens = extractNicknameTokens(pr.title);

    results.push({
      githubUserId: pr.user.id ?? null,
      githubId: pr.user.login,
      nicknameTokens,
      prNumber: pr.number,
      prUrl: pr.html_url,
      title: pr.title,
      submittedAt,
      cohort,
      status: resolvePrStatus(pr.state, pr.merged_at),
    });
  }

  return results;
}
