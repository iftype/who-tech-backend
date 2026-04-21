import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import type { AdminStatus } from '../lib/types.js';

export default function StatCards() {
  const { data: status } = useQuery({
    queryKey: ['admin-status'],
    queryFn: () => apiFetch<AdminStatus>('/admin/status'),
    staleTime: 60_000,
  });

  const cards = [
    { label: '멤버', value: status?.memberCount ?? '—' },
    { label: '활성 레포', value: status?.activeRepoCount ?? '—' },
    {
      label: '마지막 싱크',
      value: status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('ko-KR') : '—',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">{c.label}</p>
          <p className="text-xl font-bold text-gray-900">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
