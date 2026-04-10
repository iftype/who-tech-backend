import type { CohortRule } from './types/index.js';
import { badRequest } from './http.js';

/** 쿼리 파라미터 → 숫자 (필수). 문자열이 아니거나 NaN이면 NaN 반환 */
export function parseNumberQuery(value: unknown): number {
  return typeof value === 'string' ? Number(value) : NaN;
}

/** 쿼리 파라미터 → 숫자 (선택). 값이 없거나 NaN이면 undefined 반환 */
export function parseOptionalNumberQuery(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function parseId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    badRequest('invalid id');
  }

  const id = Number(value);
  if (Number.isNaN(id)) {
    badRequest('invalid id');
  }

  return id;
}

export function parseNullableString(value: unknown, fieldName: string): string | null {
  if (typeof value === 'string' || value === null) {
    return value;
  }

  badRequest(`invalid ${fieldName}`);
}

export function parseWorkspaceUpdateInput(body: unknown): {
  cohortRules?: CohortRule[];
  blogSyncEnabled?: boolean;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const { cohortRules, blogSyncEnabled } = body;

  if (cohortRules !== undefined && !isCohortRules(cohortRules)) {
    badRequest('invalid cohortRules');
  }

  if (blogSyncEnabled !== undefined && typeof blogSyncEnabled !== 'boolean') {
    badRequest('invalid blogSyncEnabled');
  }

  return {
    ...(cohortRules !== undefined ? { cohortRules } : {}),
    ...(blogSyncEnabled !== undefined ? { blogSyncEnabled } : {}),
  };
}

export function parseRepoCreateInput(body: unknown): {
  githubRepoId?: number;
  name: string;
  repoUrl: string;
  description?: string | null;
  track: string | null;
  type?: string;
  tabCategory?: string;
  status?: string;
  syncMode?: string;
  candidateReason?: string | null;
  cohorts?: number[];
  level?: number | null;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const {
    githubRepoId,
    name,
    repoUrl,
    description,
    track,
    type,
    tabCategory,
    status,
    syncMode,
    candidateReason,
    cohorts,
    level,
  } = body;

  if (githubRepoId !== undefined && typeof githubRepoId !== 'number') {
    badRequest('invalid githubRepoId');
  }

  if (typeof name !== 'string' || typeof repoUrl !== 'string') {
    badRequest('invalid repo payload');
  }

  if (track !== undefined && track !== null && typeof track !== 'string') {
    badRequest('invalid track');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    badRequest('invalid description');
  }

  if (type !== undefined && typeof type !== 'string') {
    badRequest('invalid type');
  }

  if (tabCategory !== undefined && typeof tabCategory !== 'string') {
    badRequest('invalid tabCategory');
  }

  if (status !== undefined && typeof status !== 'string') {
    badRequest('invalid status');
  }

  if (syncMode !== undefined && typeof syncMode !== 'string') {
    badRequest('invalid syncMode');
  }

  if (candidateReason !== undefined && candidateReason !== null && typeof candidateReason !== 'string') {
    badRequest('invalid candidateReason');
  }

  if (cohorts !== undefined && !isNumberArray(cohorts)) {
    badRequest('invalid cohorts');
  }

  if (level !== undefined && level !== null && typeof level !== 'number') {
    badRequest('invalid level');
  }

  return {
    ...(githubRepoId !== undefined ? { githubRepoId } : {}),
    name,
    repoUrl,
    ...(description !== undefined ? { description } : {}),
    track: track ?? null,
    ...(type !== undefined ? { type } : {}),
    ...(tabCategory !== undefined ? { tabCategory } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(syncMode !== undefined ? { syncMode } : {}),
    ...(candidateReason !== undefined ? { candidateReason } : {}),
    ...(cohorts !== undefined ? { cohorts } : {}),
    ...(level !== undefined ? { level } : {}),
  };
}

export function parseRepoUpdateInput(body: unknown): {
  description?: string | null;
  track?: string | null;
  type?: string;
  tabCategory?: string;
  status?: string;
  syncMode?: string;
  candidateReason?: string | null;
  cohorts?: number[] | null;
  level?: number | null;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const { description, track, type, tabCategory, status, syncMode, candidateReason, cohorts, level } = body;

  if (description !== undefined && description !== null && typeof description !== 'string') {
    badRequest('invalid description');
  }

  if (track !== undefined && track !== null && typeof track !== 'string') {
    badRequest('invalid track');
  }

  if (type !== undefined && typeof type !== 'string') {
    badRequest('invalid type');
  }

  if (tabCategory !== undefined && typeof tabCategory !== 'string') {
    badRequest('invalid tabCategory');
  }

  if (status !== undefined && typeof status !== 'string') {
    badRequest('invalid status');
  }

  if (syncMode !== undefined && typeof syncMode !== 'string') {
    badRequest('invalid syncMode');
  }

  if (candidateReason !== undefined && candidateReason !== null && typeof candidateReason !== 'string') {
    badRequest('invalid candidateReason');
  }

  if (cohorts !== undefined && cohorts !== null && !isNumberArray(cohorts)) {
    badRequest('invalid cohorts');
  }

  if (level !== undefined && level !== null && typeof level !== 'number') {
    badRequest('invalid level');
  }

  return {
    ...(description !== undefined ? { description } : {}),
    ...(track !== undefined ? { track } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(tabCategory !== undefined ? { tabCategory } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(syncMode !== undefined ? { syncMode } : {}),
    ...(candidateReason !== undefined ? { candidateReason } : {}),
    ...(cohorts !== undefined ? { cohorts } : {}),
    ...(level !== undefined ? { level } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCohortRules(value: unknown): value is CohortRule[] {
  return (
    Array.isArray(value) &&
    value.every((rule) => isRecord(rule) && typeof rule['year'] === 'number' && typeof rule['cohort'] === 'number')
  );
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}
