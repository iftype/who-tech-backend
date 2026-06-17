import { describe, expect, it } from '@jest/globals';
import {
  extractNicknameTokens,
  isValidNickname,
  scoreTopNicknameMatch,
  mergeNicknameStat,
  normalizeNickname,
  resolveDisplayNickname,
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
