import { useState } from 'react';
import { useMembers, type MemberFilters } from '../hooks/useMembers.js';
import StatCards from '../components/StatCards.js';
import MemberFiltersBar from '../components/members/MemberFilters.js';
import MemberAddForm from '../components/members/MemberAddForm.js';
import MemberTable from '../components/members/MemberTable.js';
import type { Member } from '../lib/types.js';

export default function MemberTab() {
  const [filters, setFilters] = useState<MemberFilters>({});
  const { members, loading, error, refetch } = useMembers(filters);

  const handleAdded = (_m: Member) => {
    void refetch();
  };

  return (
    <div className="space-y-4">
      <StatCards />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          멤버 목록 {!loading && <span className="text-gray-400 font-normal">({members.length}명)</span>}
        </h2>
      </div>
      <MemberAddForm onAdded={handleAdded} />
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
