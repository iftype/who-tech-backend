import { describe, expect, it } from '@jest/globals';
import {
  extractNicknameTokens,
  isValidNickname,
  scoreTopNicknameMatch,
  mergeNicknameStat,
  normalizeNickname,
  resolveDisplayNickname,
  stringifyNicknameStats,
} from '../../shared/nickname.js';

describe('extractNicknameTokens', () => {
  it('한글 토큰만 추출한다', () => {
    expect(extractNicknameTokens('[2단계 - 웹 기반 로또 게임] 콘티 미션 제출합니다.')).toEqual([
      '단계',
      '웹',
      '기반',
      '로또',
      '게임',
      '콘티',
      '미션',
      '제출합니다',
    ]);
  });

  it('영문·숫자만 있으면 빈 배열을 반환한다', () => {
    expect(extractNicknameTokens('No Korean here 123')).toEqual([]);
  });

  it('한글만 있으면 단일 토큰을 반환한다', () => {
    expect(extractNicknameTokens('콘티')).toEqual(['콘티']);
  });

  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(extractNicknameTokens('')).toEqual([]);
  });
});

describe('normalizeNickname', () => {
  it('trailing (note) 제거', () => {
    expect(normalizeNickname('빌리(정환희)')).toBe('빌리');
  });

  it('대괄호 제거', () => {
    expect(normalizeNickname('[버건디]')).toBe('버건디');
  });

  it('trailing 특수문자 제거', () => {
    expect(normalizeNickname('버건디!')).toBe('버건디');
    expect(normalizeNickname('버건디.')).toBe('버건디');
    expect(normalizeNickname('버건디,')).toBe('버건디');
  });

  it('중간 하이픈은 유지', () => {
    expect(normalizeNickname('manbo-p')).toBe('manbo-p');
  });

  it('정상 닉네임은 그대로', () => {
    expect(normalizeNickname('제리')).toBe('제리');
    expect(normalizeNickname('yeongunheo')).toBe('yeongunheo');
  });
});

describe('nickname stats', () => {
  it('가장 많이 나온 닉네임을 대표값으로 선택한다', () => {
    const once = mergeNicknameStat(null, '빌리(정환희)', new Date('2026-03-01T00:00:00Z'));
    const twice = mergeNicknameStat(JSON.stringify(once), '빌리', new Date('2026-03-02T00:00:00Z'));

    expect(resolveDisplayNickname(null, JSON.stringify(twice), null)).toBe('빌리');
  });

  it('manualNickname이 있으면 우선한다', () => {
    expect(resolveDisplayNickname('코치 빌리', null, '빌리')).toBe('코치 빌리');
  });
});

describe('isValidNickname', () => {
  it('20자 초과는 유효하지 않다', () => {
    expect(isValidNickname('가'.repeat(21))).toBe(false);
    expect(isValidNickname('가'.repeat(20))).toBe(true);
  });

  it('정상 닉네임은 유효하다', () => {
    expect(isValidNickname('제리')).toBe(true);
    expect(isValidNickname('manbo-p')).toBe(true);
    expect(isValidNickname('yeongunheo')).toBe(true);
  });

  it('유효하지 않은 닉네임은 mergeNicknameStat에서 무시된다', () => {
    const stats = mergeNicknameStat(null, '가'.repeat(21), new Date());
    expect(stats).toHaveLength(0);
  });
});

describe('scoreTopNicknameMatch', () => {
  // 리오(닉네임)·오영택(실명)이 상위, 나머지는 미션 키워드
  const stats = JSON.stringify([
    { nickname: '리오', count: 29, lastSeenAt: '2023-02-09T07:27:51.000Z' },
    { nickname: '오영택', count: 29, lastSeenAt: '2023-02-09T07:27:51.000Z' },
    { nickname: '경주', count: 4, lastSeenAt: '2023-02-09T07:27:51.000Z' },
    { nickname: '체스', count: 2, lastSeenAt: '2023-03-15T13:12:58.000Z' },
  ]);

  it('실명 전체(완전일치)로 매칭된다', () => {
    expect(scoreTopNicknameMatch(stats, '오영택')).toBeGreaterThanOrEqual(0);
  });

  it('실명 일부(부분 문자열)로도 매칭된다', () => {
    expect(scoreTopNicknameMatch(stats, '영택')).toBeGreaterThanOrEqual(0);
  });

  it('닉네임으로도 매칭된다', () => {
    expect(scoreTopNicknameMatch(stats, '리오')).toBeGreaterThanOrEqual(0);
  });

  it('한 글자 성씨(앞글자)도 매칭된다', () => {
    expect(scoreTopNicknameMatch(stats, '오')).toBeGreaterThanOrEqual(0);
  });

  it('점수는 매칭된 토큰의 빈도수(count)다', () => {
    expect(scoreTopNicknameMatch(stats, '오영택')).toBe(29);
    expect(scoreTopNicknameMatch(stats, '영택')).toBe(29);
  });

  it('여러 토큰이 매칭되면 빈도수가 더 높은 쪽을 점수로 쓴다', () => {
    const multi = JSON.stringify([
      { nickname: '오영택', count: 29, lastSeenAt: '2023-02-09T07:27:51.000Z' },
      { nickname: '오리', count: 10, lastSeenAt: '2023-02-09T07:27:51.000Z' },
      { nickname: '오목', count: 5, lastSeenAt: '2023-02-09T07:27:51.000Z' },
    ]);
    // "오"는 세 토큰 모두에 포함 → 가장 높은 빈도수 29
    expect(scoreTopNicknameMatch(multi, '오')).toBe(29);
  });

  it('상위 3개 밖의 미션 키워드는 매칭하지 않는다', () => {
    expect(scoreTopNicknameMatch(stats, '체스')).toBe(-1);
  });

  it('일치하는 토큰이 없으면 -1', () => {
    expect(scoreTopNicknameMatch(stats, '없는이름')).toBe(-1);
  });

  it('빈 검색어는 -1', () => {
    expect(scoreTopNicknameMatch(stats, '')).toBe(-1);
  });

  it('nicknameStats가 null이면 -1', () => {
    expect(scoreTopNicknameMatch(null, '오영택')).toBe(-1);
  });

  it('count 순서가 정렬돼 있지 않아도 상위 토큰을 기준으로 매칭한다', () => {
    const unsorted = JSON.stringify([
      { nickname: '체스', count: 2, lastSeenAt: '2023-03-15T13:12:58.000Z' },
      { nickname: '오영택', count: 29, lastSeenAt: '2023-02-09T07:27:51.000Z' },
      { nickname: '리오', count: 29, lastSeenAt: '2023-02-09T07:27:51.000Z' },
      { nickname: '경주', count: 4, lastSeenAt: '2023-02-09T07:27:51.000Z' },
    ]);
    expect(scoreTopNicknameMatch(unsorted, '오영택')).toBeGreaterThanOrEqual(0);
    expect(scoreTopNicknameMatch(unsorted, '체스')).toBe(-1);
  });
});

// 뮤테이션 테스트(Stryker)에서 살아남은 변형을 잡기 위한 경계 사례
describe('normalizeNickname 정제 규칙', () => {
  it.each([
    ['  헤일리  ', '헤일리'],
    ['빌리(정환희)', '빌리'],
    ['가 (메모) 나', '가 나'],
    [' ,-[(헤일리', '헤일리'],
    ['헤일리)] ,-', '헤일리'],
    ['헤일리!!!.,', '헤일리'],
    ['헤일리 !', '헤일리'],
    ['헤일리🙂', '헤일리'],
    ['김 헤일리', '김 헤일리'],
    ['-, 헤일리 ,-', '헤일리'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeNickname(input)).toBe(expected);
  });
});

describe('nickname stats 직렬화·병합', () => {
  const at = (iso: string) => new Date(iso);

  it('빈 통계는 null로, 나머지는 JSON으로 저장한다', () => {
    expect(stringifyNicknameStats([])).toBeNull();
    const stats = [{ nickname: '가람', count: 1, lastSeenAt: '2026-01-01T00:00:00.000Z' }];
    expect(stringifyNicknameStats(stats)).toBe(JSON.stringify(stats));
  });

  it('같은 닉네임만 횟수와 마지막 등장 시각을 올린다', () => {
    const existing = JSON.stringify([
      { nickname: '가람', count: 2, lastSeenAt: '2026-01-01T00:00:00.000Z' },
      { nickname: '미션', count: 1, lastSeenAt: '2026-01-01T00:00:00.000Z' },
    ]);

    const merged = mergeNicknameStat(existing, '가람', at('2026-02-01T00:00:00Z'));

    expect(merged).toEqual([
      { nickname: '가람', count: 3, lastSeenAt: '2026-02-01T00:00:00.000Z' },
      { nickname: '미션', count: 1, lastSeenAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  it('횟수가 많은 순, 같으면 최근에 나온 순으로 정렬한다', () => {
    const existing = JSON.stringify([
      { nickname: '옛닉', count: 5, lastSeenAt: '2025-01-01T00:00:00.000Z' },
      { nickname: '새닉', count: 1, lastSeenAt: '2026-01-01T00:00:00.000Z' },
    ]);

    const merged = mergeNicknameStat(existing, '최근', at('2026-03-01T00:00:00Z'));

    expect(merged.map((s) => s.nickname)).toEqual(['옛닉', '최근', '새닉']);
  });
});

describe('resolveDisplayNickname 우선순위', () => {
  it('수동 닉네임은 앞뒤 공백을 제거해 쓰고, 공백뿐이면 무시한다', () => {
    const stats = JSON.stringify([{ nickname: '통계닉', count: 1, lastSeenAt: '2026-01-01T00:00:00.000Z' }]);
    expect(resolveDisplayNickname('  수동  ', stats, null)).toBe('수동');
    expect(resolveDisplayNickname('   ', stats, null)).toBe('통계닉');
  });

  it('통계가 없으면 기본 닉네임을 정제해 쓰고, 그것도 없으면 null', () => {
    expect(resolveDisplayNickname(null, null, '빌리(정환희)')).toBe('빌리');
    expect(resolveDisplayNickname(null, null, null)).toBeNull();
  });
});

describe('scoreTopNicknameMatch 검색어 정제', () => {
  it('검색어 앞뒤 공백은 무시한다', () => {
    const stats = JSON.stringify([{ nickname: '조건형', count: 4, lastSeenAt: '2026-01-01T00:00:00.000Z' }]);
    expect(scoreTopNicknameMatch(stats, ' 건형 ')).toBe(4);
  });
});

describe('computeNicknameStats', () => {
  it('should be the same no matter how often or in which order submissions are counted', async () => {
    const { computeNicknameStats } = await import('../../shared/nickname.js');
    const subs = [
      { title: '[2단계] 콘티 리뷰 요청', submittedAt: new Date('2026-03-09T00:00:00Z') },
      { title: '[1단계] 콘티 제출', submittedAt: new Date('2026-03-02T00:00:00Z') },
    ];
    const a = computeNicknameStats(subs, new Set(['단계']));
    const b = computeNicknameStats([...subs].reverse(), new Set(['단계']));
    expect(a).toBe(b);
    const stats = JSON.parse(a ?? '[]') as { nickname: string; count: number; lastSeenAt: string }[];
    expect(stats[0]).toEqual({ nickname: '콘티', count: 2, lastSeenAt: '2026-03-09T00:00:00.000Z' });
    expect(stats.some((s) => s.nickname === '단계')).toBe(false);
  });

  it('should keep the current nickname when it ties with the top token', async () => {
    const { resolveDisplayNickname } = await import('../../shared/nickname.js');
    const tie = JSON.stringify([
      { nickname: '양수빈', count: 32, lastSeenAt: '2026-03-09T00:00:00.000Z' },
      { nickname: '수양', count: 32, lastSeenAt: '2026-03-09T00:00:00.000Z' },
    ]);
    expect(resolveDisplayNickname(null, tie, '수양')).toBe('수양');
    expect(resolveDisplayNickname(null, tie, null)).toBe('양수빈');
    expect(resolveDisplayNickname('수동', tie, '수양')).toBe('수동');
    const clearWinner = JSON.stringify([
      { nickname: '양수빈', count: 33, lastSeenAt: '2026-03-09T00:00:00.000Z' },
      { nickname: '수양', count: 32, lastSeenAt: '2026-03-09T00:00:00.000Z' },
    ]);
    expect(resolveDisplayNickname(null, clearWinner, '수양')).toBe('양수빈');
  });
});
