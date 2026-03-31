import { describe, expect, it } from '@jest/globals';
import {
  extractNicknameTokens,
  isValidNickname,
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
