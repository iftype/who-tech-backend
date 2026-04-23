import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import type { Member } from '../lib/types.js';

export interface MemberFilters {
  q?: string;
  cohort?: number;
  hasBlog?: boolean;
  hasCohort?: boolean;
  track?: string;
  role?: string;
}

export function useMembers(filters: MemberFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.cohort !== undefined) params.set('cohort', String(filters.cohort));
  if (filters.hasBlog !== undefined) params.set('hasBlog', String(filters.hasBlog));
  if (filters.hasCohort !== undefined) params.set('hasCohort', String(filters.hasCohort));
  if (filters.track) params.set('track', filters.track);
  if (filters.role) params.set('role', filters.role);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['members', filters],
    queryFn: () => apiFetch<Member[]>(`/admin/members?${params}`),
    staleTime: 60_000,
  });

  return {
    members: data ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch,
  };
}
