import { describe, it, expect, jest } from '@jest/globals';
import { detectCohort } from '../../infra/github/github.client.js';

describe('detectCohort', () => {
  const cohortRules = [
    { year: 2026, cohort: 8 },
    { year: 2025, cohort: 7 },
    { year: 2024, cohort: 6 },
  ];

  it('2026년 제출은 8기로 판별한다', () => {
    expect(detectCohort(new Date('2026-03-16'), cohortRules)).toBe(8);
  });

  it('2025년 제출은 7기로 판별한다', () => {
    expect(detectCohort(new Date('2025-06-01'), cohortRules)).toBe(7);
  });

  it('매핑되지 않는 연도는 null을 반환한다', () => {
    expect(detectCohort(new Date('2018-01-01'), cohortRules)).toBeNull();
  });
});

describe('rate limit retry policy', () => {
  it('should retry only short waits, at most twice', async () => {
    const { shouldRetryRateLimit } = await import('../../infra/github/github.client.js');
    expect(shouldRetryRateLimit(30, 0)).toBe(true);
    expect(shouldRetryRateLimit(60, 1)).toBe(true);
    expect(shouldRetryRateLimit(60, 2)).toBe(false); // 세 번째 재시도는 안 한다
    expect(shouldRetryRateLimit(61, 0)).toBe(false); // 1분 넘게 기다려야 하면 작업을 실패로 끝낸다 (큐가 한 시간 멈추지 않게)
    expect(shouldRetryRateLimit(3600, 0)).toBe(false);
  });
});

describe('fetchRepoPRs incremental paging', () => {
  it('should keep paging until it meets a PR older than since', async () => {
    const { fetchRepoPRs } = await import('../../infra/github/github.client.js');
    const since = new Date('2026-03-01T00:00:00Z');
    const fresh = (n: number) => ({ number: n, updated_at: '2026-03-02T00:00:00Z' });
    const stale = (n: number) => ({ number: n, updated_at: '2026-02-01T00:00:00Z' });
    const pages = [
      Array.from({ length: 100 }, (_, i) => fresh(i)),
      Array.from({ length: 100 }, (_, i) => fresh(100 + i)),
      [fresh(200), stale(201), stale(202)],
    ];
    const list = jest.fn(async ({ page }: { page: number }) => ({ data: pages[page - 1] ?? [] }));
    const octokit = { pulls: { list } } as never;

    const prs = await fetchRepoPRs(octokit, 'org', 'repo', { since, maxPages: 10 });

    expect(prs).toHaveLength(201);
    expect(list).toHaveBeenCalledTimes(3);
  });
});
