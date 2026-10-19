import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { Panel } from '../../components/ui/Section.js';

export function StatCards() {
  const { data: status } = useQuery({
    queryKey: queryKeys.adminStatus(),
    queryFn: () => adminApi.status(),
    staleTime: 60_000,
  });

  const cards = [
    { label: '멤버', value: status?.memberCount ?? '—' },
    // 상태 API는 repoCount만 준다 (싱크 탭 카드와 같은 값)
    { label: '활성 레포', value: status?.activeRepoCount ?? status?.repoCount ?? '—' },
    {
      label: '마지막 싱크',
      value: status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('ko-KR') : '—',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {cards.map((c) => (
        <Panel key={c.label} variant="cardLg" className="shadow-sm">
          <p className="text-xs text-base-500 mb-1">{c.label}</p>
          <p className="text-xl font-bold text-base-900">{c.value}</p>
        </Panel>
      ))}
    </div>
  );
}
