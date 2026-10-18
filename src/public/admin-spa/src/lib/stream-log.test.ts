import { describe, expect, it } from 'vitest';
import { formatStep, logColor } from './stream-log';
import { formatDate } from '../pages/sync/sync-format';

describe('formatStep', () => {
  it('should keep strings and stringify primitives', () => {
    expect(formatStep('진행 중')).toBe('진행 중');
    expect(formatStep(3)).toBe('3');
    expect(formatStep(null)).toBe('null');
  });

  it('should join known progress fields', () => {
    expect(formatStep({ repo: 'java-lotto', message: '수집', count: 0, percent: 50 })).toBe(
      'java-lotto · 수집 · 0건 · 50%',
    );
    expect(formatStep({ count: 12 })).toBe('12건');
  });

  it('should fall back to JSON for unknown objects', () => {
    expect(formatStep({ other: true })).toBe('{"other":true}');
  });
});

describe('formatDate', () => {
  it('should show 없음 for empty values', () => {
    expect(formatDate(null)).toBe('없음');
    expect(formatDate(undefined)).toBe('없음');
    expect(formatDate('')).toBe('없음');
  });

  it('should format dates in Korean locale', () => {
    expect(formatDate('2026-10-18T03:00:00Z')).toBe(new Date('2026-10-18T03:00:00Z').toLocaleString('ko-KR'));
  });
});

describe('logColor', () => {
  it('should color by log type', () => {
    expect(logColor('done')).toBe('text-green-400');
    expect(logColor('error')).toBe('text-red-400');
    expect(logColor('info')).toBe('text-blue-400');
    expect(logColor('progress')).toBe('text-gray-300');
  });
});
