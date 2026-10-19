import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMembers, type MemberFilters } from '../hooks/useMembers.js';

import StatCards from '../components/StatCards.js';
import MemberFiltersBar from '../components/members/MemberFilters.js';
import MemberAddForm from '../components/members/MemberAddForm.js';
import MemberTable from '../components/members/MemberTable.js';
import type { Member } from '../lib/types.js';
import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { EmptyState, SectionTitle } from '../components/ui/Section.js';

export default function MemberTab() {
  const [filters, setFilters] = useState<MemberFilters>({});
  const [cohortFilter, setCohortFilter] = useState<number | undefined>(undefined);
  const { members, loading, error, refetch } = useMembers({ ...filters, cohort: cohortFilter });

  const { data: allCohorts = [] } = useQuery({
    queryKey: queryKeys.members.cohorts(),
    queryFn: () => adminApi.members.cohorts(),
    staleTime: 300_000,
  });

  const handleAdded = (_m: Member) => {
    void refetch();
  };

  return (
    <div className="space-y-4">
      <StatCards />
      <div className="flex items-center justify-between">
        <SectionTitle>
          멤버 목록 {!loading && <span className="text-base-400 font-normal">({members.length}명)</span>}
        </SectionTitle>
      </div>
      <MemberAddForm onAdded={handleAdded} />

      <div className="flex gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setCohortFilter(undefined)}
          className={`text-xs px-3 py-1 rounded border whitespace-nowrap transition-colors ${
            cohortFilter === undefined
              ? 'bg-base-800 text-white border-base-800'
              : 'border-base-300 text-base-600 hover:bg-base-50'
          }`}
        >
          전체
        </button>
        {allCohorts.map((c) => (
          <button
            key={c}
            onClick={() => setCohortFilter(c)}
            className={`text-xs px-3 py-1 rounded border whitespace-nowrap transition-colors ${
              cohortFilter === c
                ? 'bg-primary-600 text-white border-primary-600'
                : 'border-base-300 text-base-600 hover:bg-base-50'
            }`}
          >
            {c}기
          </button>
        ))}
      </div>

      <MemberFiltersBar filters={filters} onChange={setFilters} />
      {error && (
        <div className="text-sm text-danger-500 bg-danger-50 border border-danger-200 rounded p-3">{error}</div>
      )}
      {loading ? (
        <EmptyState>로딩 중...</EmptyState>
      ) : (
        <MemberTable members={members} onRefresh={() => void refetch()} />
      )}
    </div>
  );
}
