// 상태값처럼 정해진 값만 들어가는 컬럼의 허용 목록 (ARCHITECTURE_PLAN F-3).
// SQLite·Prisma에는 enum이 없고, CHECK 제약은 Prisma가 테이블을 다시 만들 때 소리 없이 사라지므로
// 이 목록 하나를 기준으로 입력을 검증하고(어드민 API), DB 일관성 검사(db/consistency.ts)로 운영 데이터를 확인한다

export const TRACKS = ['frontend', 'backend', 'android'] as const;
export const MISSION_REPO_TYPES = ['individual', 'integration'] as const;
export const TAB_CATEGORIES = ['base', 'common', 'excluded', 'precourse'] as const;
export const MISSION_REPO_STATUSES = ['active', 'candidate', 'excluded'] as const;
export const SYNC_MODES = ['continuous', 'once'] as const;
export const RSS_STATUSES = ['unknown', 'available', 'unavailable', 'error'] as const;
export const SUBMISSION_STATUSES = ['open', 'merged', 'closed'] as const;
export const TECOTALK_MATCH_STATUSES = ['matched', 'ambiguous', 'unmatched'] as const;
export const ACTIVITY_SOURCES = ['admin', 'client', 'system'] as const;

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
