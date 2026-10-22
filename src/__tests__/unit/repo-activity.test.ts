import { describe, it, expect, jest } from '@jest/globals';
import {
  classifyActiveRepo,
  fetchRecentRepoActivity,
  planRepoActivity,
  type RepoActivity,
} from '../../features/repo/repo-activity.service.js';

const act = (name: string, prCount = 1, lastActivityAt = '2026-10-21T10:00:00Z'): RepoActivity => ({
  name,
  prCount,
  lastActivityAt,
});

describe('repo activity (#236)', () => {
  describe('planRepoActivity', () => {
    it('should add unknown repos, turn active repos with activity continuous, and quiet continuous repos once', () => {
      const known = [
        { id: 1, name: 'java-chess', status: 'active', syncMode: 'once' },
        { id: 2, name: 'java-lotto', status: 'active', syncMode: 'continuous' },
        { id: 3, name: 'java-racingcar', status: 'active', syncMode: 'continuous' },
        { id: 4, name: 'spring-roomescape', status: 'candidate', syncMode: 'once' },
        { id: 5, name: 'woowacourse-docs', status: 'excluded', syncMode: 'once' },
      ];
      const plan = planRepoActivity(known, [
        act('java-chess'),
        act('java-lotto'),
        act('spring-roomescape'),
        act('woowacourse-docs'),
        act('javascript-new-mission'),
      ]);

      expect(plan.toCreate.map((a) => a.name)).toEqual(['javascript-new-mission']);
      // 활동 있는 active·once만 continuous로. 이미 continuous면 그대로, candidate·excluded는 건드리지 않는다
      expect(plan.toContinuous.map((r) => r.name)).toEqual(['java-chess']);
      // 활동 없는 active·continuous는 once로
      expect(plan.toOnce.map((r) => r.name)).toEqual(['java-racingcar']);
    });

    it('should change nothing when there is no activity and nothing is continuous', () => {
      const plan = planRepoActivity([{ id: 1, name: 'java-chess', status: 'active', syncMode: 'once' }], []);
      expect(plan).toEqual({ toCreate: [], toContinuous: [], toOnce: [] });
    });
  });

  describe('classifyActiveRepo', () => {
    const repo = (name: string, language: string | null = null, description: string | null = null) => ({
      id: 9,
      name,
      html_url: `https://github.com/woowacourse/${name}`,
      description,
      language,
      archived: false,
      private: false,
    });

    it('should keep keyword candidates and append the activity reason', () => {
      const result = classifyActiveRepo(repo('java-blackjack'), act('java-blackjack', 12));
      expect(result).toMatchObject({ status: 'candidate', track: 'backend', tabCategory: 'base' });
      expect(result.candidateReason).toBe('java- · 최근 PR 활동 12건 (2026-10-21)');
    });

    it('should turn a repo without keyword signal into a candidate because PR activity is the signal', () => {
      const result = classifyActiveRepo(repo('kotlin-ish', 'Kotlin'), act('kotlin-ish', 3));
      expect(result).toMatchObject({ status: 'candidate' });
      const plain = classifyActiveRepo(repo('miniproject'), act('miniproject', 3));
      expect(plain).toMatchObject({ status: 'candidate', track: null, tabCategory: 'common' });
      expect(plain.candidateReason).toBe('최근 PR 활동 3건 (2026-10-21)');
    });

    it('should keep exclude-keyword repos excluded', () => {
      const result = classifyActiveRepo(repo('woowacourse-docs'), act('woowacourse-docs'));
      expect(result.status).toBe('excluded');
    });
  });

  describe('fetchRecentRepoActivity', () => {
    it('should query one day at a time, follow pages, and group PRs by repo', async () => {
      const item = (repo: string, updated: string) => ({
        repository_url: `https://api.github.com/repos/woowacourse/${repo}`,
        updated_at: updated,
      });
      const full = Array.from({ length: 100 }, () => item('java-chess', '2026-10-22T01:00:00Z'));
      const search = jest.fn(async ({ q, page }: { q: string; page: number }) => {
        if (q.includes('2026-10-22') && page === 1) return { data: { items: full } };
        if (q.includes('2026-10-22') && page === 2)
          return { data: { items: [item('java-lotto', '2026-10-22T05:00:00Z')] } };
        if (q.includes('2026-10-21')) return { data: { items: [item('java-chess', '2026-10-21T09:00:00Z')] } };
        return { data: { items: [] } };
      });
      const octokit = { rest: { search: { issuesAndPullRequests: search } } };

      const result = await fetchRecentRepoActivity(
        octokit as never,
        'woowacourse',
        new Date('2026-10-22T12:00:00Z'),
        2,
      );

      expect(search.mock.calls.map(([args]) => [args.q, args.page])).toEqual([
        ['org:woowacourse is:pr updated:2026-10-22', 1],
        ['org:woowacourse is:pr updated:2026-10-22', 2],
        ['org:woowacourse is:pr updated:2026-10-21', 1],
      ]);
      expect(result).toEqual([
        { name: 'java-chess', prCount: 101, lastActivityAt: '2026-10-22T01:00:00Z' },
        { name: 'java-lotto', prCount: 1, lastActivityAt: '2026-10-22T05:00:00Z' },
      ]);
    });
  });
});
