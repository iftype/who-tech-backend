import type { CohortRule } from '../../shared/types/index.js';
import { badRequest } from '../../shared/http.js';
import { isRecord } from '../../shared/validation.js';

// PUT /admin/workspace 요청 본문 검증
export function parseWorkspaceUpdateInput(body: unknown): {
  cohortRules?: CohortRule[];
  blogSyncEnabled?: boolean;
  profileRefreshEnabled?: boolean;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const { cohortRules, blogSyncEnabled, profileRefreshEnabled } = body;

  if (cohortRules !== undefined && !isCohortRules(cohortRules)) {
    badRequest('invalid cohortRules');
  }

  if (blogSyncEnabled !== undefined && typeof blogSyncEnabled !== 'boolean') {
    badRequest('invalid blogSyncEnabled');
  }

  if (profileRefreshEnabled !== undefined && typeof profileRefreshEnabled !== 'boolean') {
    badRequest('invalid profileRefreshEnabled');
  }

  return {
    ...(cohortRules !== undefined ? { cohortRules } : {}),
    ...(blogSyncEnabled !== undefined ? { blogSyncEnabled } : {}),
    ...(profileRefreshEnabled !== undefined ? { profileRefreshEnabled } : {}),
  };
}

function isCohortRules(value: unknown): value is CohortRule[] {
  return (
    Array.isArray(value) &&
    value.every((rule) => isRecord(rule) && typeof rule['year'] === 'number' && typeof rule['cohort'] === 'number')
  );
}
