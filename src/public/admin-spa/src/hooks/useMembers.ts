import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { useDebouncedValue } from './useDebouncedValue.js';

export interface MemberFilters {
  q?: string;
  cohort?: number;
  hasBlog?: boolean;
  track?: string;
  role?: string;
}

export const SEARCH_DEBOUNCE_MS = 300;

// 멤버 목록. 검색어는 300ms 멈춘 뒤에 요청하고, 새 결과가 올 때까지 이전 목록을 보여 준다
// (예전에는 글자마다 요청하고 그때마다 표 전체가 "로딩 중"으로 바뀌었다)
export function useMembers(filters: MemberFilters = {}) {
  const q = useDebouncedValue(filters.q, SEARCH_DEBOUNCE_MS);
  // 쿼리 키 해시는 undefined 값을 빼므로 q가 없으면 예전 키와 같다
  const effective: MemberFilters = { ...filters, q: q || undefined };

  const params = new URLSearchParams();
  if (effective.q) params.set('q', effective.q);
  if (effective.cohort !== undefined) params.set('cohort', String(effective.cohort));
  if (effective.hasBlog !== undefined) params.set('hasBlog', String(effective.hasBlog));
  if (effective.track) params.set('track', effective.track);
  if (effective.role) params.set('role', effective.role);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.members.list(effective),
    queryFn: () => adminApi.members.list(String(params)),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    members: data ?? [],
    // 첫 로드만 "로딩 중". 필터를 바꾸는 동안은 이전 목록을 유지한다
    loading: isPending,
    fetching: isFetching,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch,
  };
}
