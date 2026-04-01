import { describe, it, expect } from '@jest/globals';
import { detectCohort } from '../../features/sync/github.service.js';

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
