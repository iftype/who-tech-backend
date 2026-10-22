import { badRequest } from './http.js';
import { TRACKS, isOneOf } from './domain.js';

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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}

/** 쿼리의 트랙. 정해진 트랙(TRACKS)이 아니면(`all`·오타 등) 필터 없음 — 웹의 parseTrack과 같은 규칙 (#230) */
export function parseTrackQuery(value: unknown): (typeof TRACKS)[number] | undefined {
  return isOneOf(TRACKS, value) ? value : undefined;
}
