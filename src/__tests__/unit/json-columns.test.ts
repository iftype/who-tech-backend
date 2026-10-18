import { describe, expect, it } from '@jest/globals';
import { parseCohortRules } from '../../shared/cohort-rules.js';
import { parseCohorts } from '../../shared/cohort-regex.js';
import { parseNicknameStats, scoreTopNicknameMatch } from '../../shared/nickname.js';

// DB의 JSON 문자열 컬럼을 읽는 함수들 (ARCHITECTURE_PLAN F-4): 형식이 틀린 값이 들어와도 API 전체가 죽지 않아야 한다
describe('JSON column parsers', () => {
  describe('parseCohortRules', () => {
    it('should parse year-to-cohort rules', () => {
      expect(parseCohortRules('[{"year":2026,"cohort":8}]')).toEqual([{ year: 2026, cohort: 8 }]);
      expect(parseCohortRules('[]')).toEqual([]);
    });

    it('should fail loudly with the reason when the value is broken', () => {
      expect(() => parseCohortRules('{bad')).toThrow('invalid workspace cohortRules: not JSON');
      expect(() => parseCohortRules('{"year":2026}')).toThrow('expected [{ year, cohort }]');
      expect(() => parseCohortRules('[{"year":"2026","cohort":8}]')).toThrow('expected [{ year, cohort }]');
    });
  });

  describe('parseNicknameStats', () => {
    it('should keep only well-formed entries', () => {
      expect(
        parseNicknameStats(
          '[{"nickname":"하루","count":3,"lastSeenAt":"2026-03-12T10:00:00.000Z"},{"nickname":1},{"count":2}]',
        ),
      ).toEqual([{ nickname: '하루', count: 3, lastSeenAt: '2026-03-12T10:00:00.000Z' }]);
    });

    it('should treat broken values as no stats instead of throwing', () => {
      expect(parseNicknameStats('{"하루":3}')).toEqual([]);
      expect(parseNicknameStats('{bad')).toEqual([]);
      expect(parseNicknameStats(null)).toEqual([]);
    });

    it('should not break nickname search on a broken value (was a 500)', () => {
      expect(scoreTopNicknameMatch('{"하루":3}', '하루')).toBe(-1);
    });
  });

  describe('parseCohorts', () => {
    it('should keep only numbers', () => {
      expect(parseCohorts('[7,8]')).toEqual([7, 8]);
      expect(parseCohorts('[7,"8",null]')).toEqual([7]);
      expect(parseCohorts('{"a":1}')).toEqual([]);
      expect(parseCohorts('{bad')).toEqual([]);
    });
  });
});
