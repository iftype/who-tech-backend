import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import type { CohortRule } from '../../shared/types/index.js';

const ThrottledOctokit = Octokit.plugin(throttling);
import { normalizeBlogUrl } from '../../shared/blog.js';
import { throwIfCancelled } from '../../shared/errors.js';

export function detectCohort(submittedAt: Date, cohortRules: CohortRule[]): number | null {
  const year = submittedAt.getFullYear();
  return cohortRules.find((rule) => rule.year === year)?.cohort ?? null;
}

const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_RATE_LIMIT_WAIT_SECONDS = 60;

// GitHub 레이트리밋에 걸렸을 때 기다렸다 다시 할지. 예전에는 항상 재시도해서 시간당 한도를 다 쓰면
// 리셋(최대 1시간)까지 싱크 큐의 단일 작업자가 멈췄다 → 짧게 기다리면 되는 경우만 2번까지 재시도하고,
// 아니면 요청을 실패시켜 그 레포는 실패로 기록(활동 로그)하고 다음 레포로 넘어간다
export function shouldRetryRateLimit(retryAfterSeconds: number, retryCount: number): boolean {
  return retryCount < MAX_RATE_LIMIT_RETRIES && retryAfterSeconds <= MAX_RATE_LIMIT_WAIT_SECONDS;
}

export function createOctokit(token?: string): Octokit {
  return new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        const retry = shouldRetryRateLimit(retryAfter, retryCount);
        octokit.log.warn(
          `rate limit: ${options.method} ${options.url} — retry after ${retryAfter}s (${retry ? 'retrying' : 'giving up'})`,
        );
        return retry;
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        const retry = shouldRetryRateLimit(retryAfter, retryCount);
        octokit.log.warn(
          `secondary rate limit: ${options.method} ${options.url} — retry after ${retryAfter}s (${retry ? 'retrying' : 'giving up'})`,
        );
        return retry;
      },
    },
  }) as unknown as Octokit;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function fetchRepoPRs(
  octokit: Octokit,
  org: string,
  repo: string,
  options: {
    perPage?: number;
    since?: Date;
    maxPages?: number;
    signal?: AbortSignal;
    sort?: 'updated' | 'created';
    direction?: 'asc' | 'desc';
  } = {},
): Promise<Awaited<ReturnType<typeof octokit.pulls.list>>['data']> {
  const { perPage = 100, since, maxPages, signal, sort = 'updated', direction = 'desc' } = options;
  const allPRs = [];
  let page = 1;

  while (true) {
    throwIfCancelled(signal);

    let data: Awaited<ReturnType<typeof octokit.pulls.list>>['data'];
    try {
      ({ data } = await octokit.pulls.list({
        owner: org,
        repo,
        state: 'all',
        sort,
        direction,
        per_page: perPage,
        page,
        ...(signal ? { request: { signal } } : {}),
      }));
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error ? ` status=${String(error.status)}` : '';
      throw new Error(`fetch_prs failed: ${org}/${repo} page=${page}${status} ${errorMessage(error)}`);
    }

    if (data.length === 0) break;

    if (since) {
      const fresh = data.filter((pr) => new Date(pr.updated_at) > since);
      allPRs.push(...fresh);
      if (fresh.length < data.length) break;
    } else {
      allPRs.push(...data);
    }

    if (data.length < perPage) break;
    if (maxPages && page >= maxPages) break;
    page++;
  }

  return allPRs;
}

export async function fetchUserProfile(
  octokit: Octokit,
  input: { username?: string; githubUserId?: number | null },
  ignoredDomains: string[] = [],
  signal?: AbortSignal,
): Promise<{ githubUserId: number | null; githubId: string; blog: string | null; avatarUrl: string | null }> {
  let data;

  if (input.githubUserId != null) {
    const response = await octokit.request('GET /user/{account_id}', {
      account_id: input.githubUserId,
      ...(signal ? { request: { signal } } : {}),
    });
    data = response.data;
  } else if (input.username) {
    const response = await octokit.users.getByUsername({
      username: input.username,
      ...(signal ? { request: { signal } } : {}),
    });
    data = response.data;
  } else {
    throw new Error('username or githubUserId required');
  }

  return {
    githubUserId: data.id ?? input.githubUserId ?? null,
    githubId: data.login,
    blog: normalizeBlogUrl(data.blog, ignoredDomains),
    avatarUrl: data.avatar_url ?? null,
  };
}

function extractUrlsFromText(text: string, ignoredDomains: string[]): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]"',]+/g) ?? [];
  return matches.map((u) => normalizeBlogUrl(u, ignoredDomains)).filter((u): u is string => u !== null);
}

export async function fetchUserBlogCandidates(
  octokit: Octokit,
  input: { username?: string; githubUserId?: number | null },
  ignoredDomains: string[] = [],
  signal?: AbortSignal,
): Promise<{
  profile: { githubUserId: number | null; githubId: string; avatarUrl: string | null };
  candidates: string[];
}> {
  let data;

  if (input.githubUserId != null) {
    const response = await octokit.request('GET /user/{account_id}', {
      account_id: input.githubUserId,
      ...(signal ? { request: { signal } } : {}),
    });
    data = response.data;
  } else if (input.username) {
    const response = await octokit.users.getByUsername({
      username: input.username,
      ...(signal ? { request: { signal } } : {}),
    });
    data = response.data;
  } else {
    throw new Error('username or githubUserId required');
  }

  const seen = new Set<string>();
  const candidates: string[] = [];

  const push = (url: string | null | undefined) => {
    const normalized = normalizeBlogUrl(url ?? null, ignoredDomains);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      candidates.push(normalized);
    }
  };

  // 1. blog 필드
  push(data.blog);

  // 2. bio에서 URL 추출
  if (data.bio) {
    for (const url of extractUrlsFromText(data.bio, ignoredDomains)) push(url);
  }

  // 3. social_accounts API
  try {
    const { data: socials } = await octokit.request('GET /users/{username}/social_accounts', {
      username: data.login,
      ...(signal ? { request: { signal } } : {}),
    });
    for (const s of socials) push(s.url);
  } catch {
    // 실패해도 무시
  }

  return {
    profile: {
      githubUserId: data.id ?? input.githubUserId ?? null,
      githubId: data.login,
      avatarUrl: data.avatar_url ?? null,
    },
    candidates,
  };
}

export async function fetchUserBlogUrl(octokit: Octokit, username: string): Promise<string | null> {
  const { blog } = await fetchUserProfile(octokit, { username });
  return blog;
}
