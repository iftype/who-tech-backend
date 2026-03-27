import type { CohortRegexRule } from './types/index.js';

export function parseCohortRegexRules(value: string | null | undefined): CohortRegexRule[] {
  if (!value) {
    return [];
  }

  return JSON.parse(value) as CohortRegexRule[];
}

export function stringifyCohortRegexRules(rules: CohortRegexRule[] | null | undefined): string | null {
  if (!rules || rules.length === 0) {
    return null;
  }

  return JSON.stringify(rules);
}

export function parseCohorts(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

export function findNicknameRegexByCohort(cohortRegexRules: CohortRegexRule[], cohort: number | null): string | null {
  if (cohort === null) {
    return null;
  }

  return cohortRegexRules.find((rule) => rule.cohort === cohort)?.nicknameRegex ?? null;
}
