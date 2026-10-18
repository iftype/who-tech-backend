import { describe, it, expect } from '@jest/globals';
import { parseId, parseNullableString, parseNumberQuery, parseOptionalNumberQuery } from '../../shared/validation.js';
import { parseRepoCreateInput, parseRepoUpdateInput } from '../../features/repo/repo.validation.js';
import { parseWorkspaceUpdateInput } from '../../features/workspace/workspace.validation.js';
import { HttpError } from '../../shared/http.js';

function expectBadRequest(fn: () => unknown, message: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).statusCode).toBe(400);
    expect((e as HttpError).message).toBe(message);
    return;
  }
  throw new Error(`expected bad request: ${message}`);
}

describe('validation', () => {
  describe('parseNumberQuery', () => {
    it('should convert numeric strings to numbers', () => {
      expect(parseNumberQuery('8')).toBe(8);
      expect(parseNumberQuery('0')).toBe(0);
    });

    it('should return NaN for non-string or non-numeric values', () => {
      expect(parseNumberQuery(undefined)).toBeNaN();
      expect(parseNumberQuery(8)).toBeNaN();
      expect(parseNumberQuery('abc')).toBeNaN();
    });
  });

  describe('parseOptionalNumberQuery', () => {
    it('should convert numeric strings to numbers', () => {
      expect(parseOptionalNumberQuery('7')).toBe(7);
      expect(parseOptionalNumberQuery('0')).toBe(0);
    });

    it('should return undefined for missing or non-numeric values', () => {
      expect(parseOptionalNumberQuery(undefined)).toBeUndefined();
      expect(parseOptionalNumberQuery(['7'])).toBeUndefined();
      expect(parseOptionalNumberQuery('seven')).toBeUndefined();
    });
  });

  describe('parseId', () => {
    it('should parse a numeric id', () => {
      expect(parseId('42')).toBe(42);
    });

    it('should reject arrays and non-numeric ids', () => {
      expectBadRequest(() => parseId(['1', '2']), 'invalid id');
      expectBadRequest(() => parseId('abc'), 'invalid id');
      expectBadRequest(() => parseId(undefined), 'invalid id');
    });
  });

  describe('parseNullableString', () => {
    it('should accept strings and null', () => {
      expect(parseNullableString('hello', 'blog')).toBe('hello');
      expect(parseNullableString('', 'blog')).toBe('');
      expect(parseNullableString(null, 'blog')).toBeNull();
    });

    it('should reject other types with the field name', () => {
      expectBadRequest(() => parseNullableString(undefined, 'blog'), 'invalid blog');
      expectBadRequest(() => parseNullableString(1, 'manualNickname'), 'invalid manualNickname');
    });
  });

  describe('parseWorkspaceUpdateInput', () => {
    it('should return only provided fields', () => {
      expect(parseWorkspaceUpdateInput({})).toEqual({});
      expect(parseWorkspaceUpdateInput({ blogSyncEnabled: false })).toEqual({ blogSyncEnabled: false });
    });

    it('should accept valid cohort rules and flags together', () => {
      const cohortRules = [{ year: 2026, cohort: 8 }];
      expect(
        parseWorkspaceUpdateInput({ cohortRules, blogSyncEnabled: true, profileRefreshEnabled: false, ignored: 1 }),
      ).toEqual({ cohortRules, blogSyncEnabled: true, profileRefreshEnabled: false });
    });

    it('should accept an empty cohort rule list', () => {
      expect(parseWorkspaceUpdateInput({ cohortRules: [] })).toEqual({ cohortRules: [] });
    });

    it('should reject a non-object body', () => {
      expectBadRequest(() => parseWorkspaceUpdateInput(null), 'invalid body');
      expectBadRequest(() => parseWorkspaceUpdateInput('x'), 'invalid body');
    });

    it('should reject malformed cohort rules', () => {
      expectBadRequest(() => parseWorkspaceUpdateInput({ cohortRules: 'x' }), 'invalid cohortRules');
      expectBadRequest(() => parseWorkspaceUpdateInput({ cohortRules: [null] }), 'invalid cohortRules');
      expectBadRequest(
        () => parseWorkspaceUpdateInput({ cohortRules: [{ year: '2026', cohort: 8 }] }),
        'invalid cohortRules',
      );
      expectBadRequest(
        () => parseWorkspaceUpdateInput({ cohortRules: [{ year: 2026, cohort: '8' }] }),
        'invalid cohortRules',
      );
    });

    it('should reject non-boolean flags', () => {
      expectBadRequest(() => parseWorkspaceUpdateInput({ blogSyncEnabled: 'true' }), 'invalid blogSyncEnabled');
      expectBadRequest(() => parseWorkspaceUpdateInput({ profileRefreshEnabled: 1 }), 'invalid profileRefreshEnabled');
    });
  });

  describe('parseRepoCreateInput', () => {
    const base = { name: 'java-racingcar', repoUrl: 'https://github.com/woowacourse/java-racingcar' };

    it('should require name and repoUrl and default track to null', () => {
      expect(parseRepoCreateInput(base)).toEqual({ ...base, track: null });
    });

    it('should pass through all valid optional fields', () => {
      const input = {
        ...base,
        githubRepoId: 123,
        description: null,
        track: 'backend',
        type: 'integration',
        tabCategory: 'common',
        status: 'candidate',
        syncMode: 'once',
        candidateReason: 'discovered',
        cohorts: [7, 8],
        level: null,
      };
      expect(parseRepoCreateInput(input)).toEqual(input);
    });

    it('should keep explicit empty values', () => {
      expect(parseRepoCreateInput({ ...base, description: '', candidateReason: null, cohorts: [], level: 0 })).toEqual({
        ...base,
        track: null,
        description: '',
        candidateReason: null,
        cohorts: [],
        level: 0,
      });
    });

    it('should reject a non-object body and missing required fields', () => {
      expectBadRequest(() => parseRepoCreateInput(undefined), 'invalid body');
      expectBadRequest(() => parseRepoCreateInput({ name: 'x' }), 'invalid repo payload');
      expectBadRequest(() => parseRepoCreateInput({ repoUrl: 'x' }), 'invalid repo payload');
    });

    it.each([
      ['githubRepoId', '123'],
      ['track', 1],
      ['description', 1],
      ['type', 1],
      ['tabCategory', 1],
      ['status', 1],
      ['syncMode', 1],
      ['candidateReason', 1],
      ['cohorts', [7, '8']],
      ['level', '1'],
    ])('should reject invalid %s', (field, value) => {
      expectBadRequest(() => parseRepoCreateInput({ ...base, [field]: value }), `invalid ${field}`);
    });
  });

  describe('parseRepoUpdateInput', () => {
    it('should return only provided fields', () => {
      expect(parseRepoUpdateInput({})).toEqual({});
      expect(parseRepoUpdateInput({ status: 'active' })).toEqual({ status: 'active' });
    });

    it('should allow clearing nullable fields', () => {
      expect(
        parseRepoUpdateInput({ description: null, track: null, candidateReason: null, cohorts: null, level: null }),
      ).toEqual({ description: null, track: null, candidateReason: null, cohorts: null, level: null });
    });

    it('should pass through all valid fields', () => {
      const input = {
        description: 'd',
        track: 'frontend',
        type: 'individual',
        tabCategory: 'base',
        status: 'excluded',
        syncMode: 'continuous',
        candidateReason: 'r',
        cohorts: [8],
        level: 2,
      };
      expect(parseRepoUpdateInput(input)).toEqual(input);
    });

    it('should reject a non-object body', () => {
      expectBadRequest(() => parseRepoUpdateInput(null), 'invalid body');
    });

    it.each([
      ['description', 1],
      ['track', 1],
      ['type', 1],
      ['tabCategory', 1],
      ['status', 1],
      ['syncMode', 1],
      ['candidateReason', 1],
      ['cohorts', 'x'],
      ['level', '1'],
    ])('should reject invalid %s', (field, value) => {
      expectBadRequest(() => parseRepoUpdateInput({ [field]: value }), `invalid ${field}`);
    });
  });
});
