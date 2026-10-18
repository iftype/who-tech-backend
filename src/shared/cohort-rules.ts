import type { CohortRule } from './types/index.js';
import { isRecord } from './validation.js';

// Workspace.cohortRules(JSON): 연도 → 기수 매핑. 입력 검증과 DB에서 읽을 때 같은 기준을 쓴다 (ARCHITECTURE_PLAN F-4)
export function isCohortRules(value: unknown): value is CohortRule[] {
  return (
    Array.isArray(value) &&
    value.every((rule) => isRecord(rule) && typeof rule['year'] === 'number' && typeof rule['cohort'] === 'number')
  );
}

/** DB의 cohortRules를 읽는다. 형식이 틀리면 원인을 알 수 있게 실패한다 (기수 판별이 조용히 틀어지지 않도록) */
export function parseCohortRules(raw: string): CohortRule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid workspace cohortRules: not JSON');
  }
  if (!isCohortRules(parsed)) throw new Error('invalid workspace cohortRules: expected [{ year, cohort }]');
  return parsed;
}
