import { useState, useMemo } from 'react';
import { useMembers, type MemberFilters } from '../hooks/useMembers.js';
import StatCards from '../components/StatCards.js';
import MemberFiltersBar from '../components/members/MemberFilters.js';
import MemberAddForm from '../components/members/MemberAddForm.js';
import MemberTable from '../components/members/MemberTable.js';
import type { Member } from '../lib/types.js';

export default function MemberTab() {
  const [filters, setFilters] = useState<MemberFilters>({});
  const [cohortFilter, setCohortFilter] = useState<number | undefined>(undefined);
  const { members, loading, error, refetch } = useMembers({ ...filters, cohort: cohortFilter });

  const handleAdded = (_m: Member) => {
    void refetch();
  };

  const allCohorts = useMemo(() => {
    const set = new Set<number>();
    members.forEach(m => m.cohorts.forEach(c => set.add(c.cohort)));
    return [...set].sort((a, b) => a - b);
  }, [members]);

  return (
    <div className="space-y-4">
      <StatCards />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          멤버 목록 {!loading && <span className="text-gray-400 font-normal">({members.length}명)</span>}
        </h2>
      </div>
      <MemberAddForm onAdded={handleAdded} />

      <div className="flex gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setCohortFilter(undefined)}
          className={`text-xs px-3 py-1 rounded border whitespace-nowrap transition-colors ${
            cohortFilter === undefined
              ? 'bg-gray-800 text-white border-gray-800'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          전체
        </button>
        {allCohorts.map(c => (
          <button
            key={c}
            onClick={() => setCohortFilter(c)}
            className={`text-xs px-3 py-1 rounded border whitespace-nowrap transition-colors ${
              cohortFilter === c
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {c}기
          </button>
        ))}
      </div>

      <MemberFiltersBar filters={filters} onChange={setFilters} />
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-3">{error}</div>
      )}
      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
      ) : (
        <MemberTable members={members} onRefresh={() => void refetch()} />
      )}
    </div>
  );
}
