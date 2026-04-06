import { describe, it, expect } from '@jest/globals';
import { parsePRsToSubmissions } from '../../features/sync/sync.service.js';

const COHORT_RULES = [
  { year: 2026, cohort: 8 },
  { year: 2025, cohort: 7 },
];

const mockPRs = [
  {
    number: 475,
    html_url: 'https://github.com/woowacourse/javascript-lotto/pull/475',
    title: '[2단계 - 웹 기반 로또 게임] 콘티 미션 제출합니다.',
    user: { login: 'iftype', id: 1001 },
    base: { ref: 'iftype' },
    created_at: '2026-03-16T05:59:39Z',
    state: 'open' as const,
    merged_at: null,
  },
  {
    number: 474,
    html_url: 'https://github.com/woowacourse/javascript-lotto/pull/474',
    title: '[2단계 - 웹 기반 로또 게임] 해니 제출합니다.',
    user: { login: 'janghw0126', id: 1002 },
    base: { ref: 'janghw0126' },
    created_at: '2025-03-16T05:54:06Z',
    state: 'open' as const,
    merged_at: null,
  },
  {
    number: 400,
    html_url: 'https://github.com/woowacourse/javascript-lotto/pull/400',
    title: '형식이 다른 PR입니다.',
    user: { login: 'someone', id: 1003 },
    base: { ref: 'someone' },
    created_at: '2026-01-01T00:00:00Z',
    state: 'open' as const,
    merged_at: null,
  },
];

describe('parsePRsToSubmissions', () => {
  it('PR 목록 전체를 파싱한다 (토큰 없는 PR도 포함)', () => {
    const result = parsePRsToSubmissions(mockPRs, COHORT_RULES);
    expect(result).toHaveLength(3);
  });

  it('githubId를 올바르게 파싱한다', () => {
    const result = parsePRsToSubmissions(mockPRs, COHORT_RULES);
    expect(result[0]?.githubId).toBe('iftype');
    expect(result[1]?.githubId).toBe('janghw0126');
  });

  it('PR 제목에서 한글 토큰을 추출한다', () => {
    const result = parsePRsToSubmissions(mockPRs, COHORT_RULES);
    expect(result[0]?.nicknameTokens).toContain('콘티');
    expect(result[0]?.nicknameTokens).toContain('미션');
    expect(result[1]?.nicknameTokens).toContain('해니');
  });

  it('한글이 없는 PR은 빈 토큰 배열을 가진다', () => {
    const noPR = [{ ...mockPRs[2]!, title: 'no korean title' }];
    const result = parsePRsToSubmissions(noPR, COHORT_RULES);
    expect(result[0]?.nicknameTokens).toHaveLength(0);
  });

  it('기수를 올바르게 판별한다', () => {
    const result = parsePRsToSubmissions(mockPRs, COHORT_RULES);
    expect(result[0]?.cohort).toBe(8);
    expect(result[1]?.cohort).toBe(7);
  });

  it('PR 번호와 URL을 올바르게 저장한다', () => {
    const result = parsePRsToSubmissions(mockPRs, COHORT_RULES);
    expect(result[0]?.prNumber).toBe(475);
    expect(result[0]?.prUrl).toBe('https://github.com/woowacourse/javascript-lotto/pull/475');
  });

  it('user가 null인 PR은 제외한다', () => {
    const nullUserPRs = [{ ...mockPRs[0]!, user: null }];
    const result = parsePRsToSubmissions(nullUserPRs, COHORT_RULES);
    expect(result).toHaveLength(0);
  });

  it('탈퇴한 GitHub 계정(ghost)의 PR은 제외한다', () => {
    const ghostPRs = [{ ...mockPRs[0]!, user: { login: 'ghost', id: 10137 } }];
    const result = parsePRsToSubmissions(ghostPRs, COHORT_RULES);
    expect(result).toHaveLength(0);
  });

  it('병합되지 않고 닫힌 PR도 closed 상태로 포함한다', () => {
    const closedPRs = [{ ...mockPRs[0]!, state: 'closed' as const, merged_at: null }];
    const result = parsePRsToSubmissions(closedPRs, COHORT_RULES);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('closed');
  });

  it('병합된 PR은 merged 상태로 포함한다', () => {
    const mergedPRs = [{ ...mockPRs[0]!, state: 'closed' as const, merged_at: '2026-03-17T00:00:00Z' }];
    const result = parsePRsToSubmissions(mergedPRs, COHORT_RULES);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('merged');
  });
});
