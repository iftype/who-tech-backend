import {
  isOneOf,
  MISSION_REPO_STATUSES,
  MISSION_REPO_TYPES,
  SYNC_MODES,
  TAB_CATEGORIES,
  TRACKS,
} from '../../shared/domain.js';
import { badRequest } from '../../shared/http.js';
import { isNumberArray, isRecord } from '../../shared/validation.js';

// POST·PATCH /admin/repos 요청 본문 검증
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

  if (track !== undefined && track !== null && !isOneOf(TRACKS, track)) {
    badRequest('invalid track');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    badRequest('invalid description');
  }

  if (type !== undefined && !isOneOf(MISSION_REPO_TYPES, type)) {
    badRequest('invalid type');
  }

  if (tabCategory !== undefined && !isOneOf(TAB_CATEGORIES, tabCategory)) {
    badRequest('invalid tabCategory');
  }

  if (status !== undefined && !isOneOf(MISSION_REPO_STATUSES, status)) {
    badRequest('invalid status');
  }

  if (syncMode !== undefined && !isOneOf(SYNC_MODES, syncMode)) {
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

  if (track !== undefined && track !== null && !isOneOf(TRACKS, track)) {
    badRequest('invalid track');
  }

  if (type !== undefined && !isOneOf(MISSION_REPO_TYPES, type)) {
    badRequest('invalid type');
  }

  if (tabCategory !== undefined && !isOneOf(TAB_CATEGORIES, tabCategory)) {
    badRequest('invalid tabCategory');
  }

  if (status !== undefined && !isOneOf(MISSION_REPO_STATUSES, status)) {
    badRequest('invalid status');
  }

  if (syncMode !== undefined && !isOneOf(SYNC_MODES, syncMode)) {
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
