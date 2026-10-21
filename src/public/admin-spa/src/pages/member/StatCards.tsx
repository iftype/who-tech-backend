import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { StatCard, StatGrid } from '../../components/ui/StatCard.js';

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
    <StatGrid columns={3} className="mb-6">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} />
      ))}
    </StatGrid>
  );
}
