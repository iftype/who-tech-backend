import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api.js';
import type { Member } from '../lib/types.js';

export interface MemberFilters {
  q?: string;
  cohort?: number;
  hasBlog?: boolean;
  track?: string;
  role?: string;
}

export function useMembers(filters: MemberFilters = {}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.cohort !== undefined) params.set('cohort', String(filters.cohort));
      if (filters.hasBlog !== undefined) params.set('hasBlog', String(filters.hasBlog));
      if (filters.track) params.set('track', filters.track);
      if (filters.role) params.set('role', filters.role);
      const data = await apiFetch<Member[]>(`/admin/members?${params}`);
      setMembers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filters.q, filters.cohort, filters.hasBlog, filters.track, filters.role]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { members, loading, error, refetch: fetch };
}
