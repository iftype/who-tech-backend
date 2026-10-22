import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { Button } from '../../components/ui/Button.js';
import { Panel, SectionTitle } from '../../components/ui/Section.js';
import type { TecoTalkAdminItem } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { formatDate } from './sync-format.js';
import { countTecoTalkMatches } from './tecotalk-counts.js';

export function TecoTalkPanel({ tecoTalks }: { tecoTalks: TecoTalkAdminItem[] }) {
  const queryClient = useQueryClient();
  const counts = countTecoTalkMatches(tecoTalks);
  const latestTecoTalk = tecoTalks[0];

  const tecoTalkSyncMutation = useMutation({
    mutationFn: (mode: 'incremental' | 'full') => adminApi.tecotalk.sync(mode),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tecotalkSyncStatus() });
      showToast(
        `테코톡 싱크 완료 — ${result.matched}/${result.total} 매칭, ambiguous ${result.ambiguous}, unmatched ${result.unmatched}`,
      );
    },
    meta: { errorMessage: '테코톡 싱크 실패' },
  });

  return (
    <Panel variant="card" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle as="h3" size="sm">
            테코톡
          </SectionTitle>
          <p className="text-2xs text-base-400 mt-1">
            최신 업로드:{' '}
            {latestTecoTalk ? `${latestTecoTalk.title} · ${formatDate(latestTecoTalk.uploadedAt)}` : '없음'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => tecoTalkSyncMutation.mutate('incremental')}
            disabled={tecoTalkSyncMutation.isPending}
            tone="danger"
          >
            {tecoTalkSyncMutation.isPending ? '싱크 중...' : '증분 싱크'}
          </Button>
          <Button
            onClick={() => tecoTalkSyncMutation.mutate('full')}
            disabled={tecoTalkSyncMutation.isPending}
            tone="neutral"
          >
            {tecoTalkSyncMutation.isPending ? '싱크 중...' : '전체 재매칭'}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="rounded border border-base-200 bg-base-50 p-2">
          <p className="text-base-500">전체</p>
          <p className="font-semibold text-base-900">{tecoTalks.length}</p>
        </div>
        <div className="rounded border border-success-200 bg-success-50 p-2">
          <p className="text-success-700">matched</p>
          <p className="font-semibold text-success-900">{counts.matched}</p>
        </div>
        <div className="rounded border border-caution-200 bg-caution-50 p-2">
          <p className="text-caution-700">ambiguous</p>
          <p className="font-semibold text-caution-900">{counts.ambiguous}</p>
        </div>
        <div className="rounded border border-danger-200 bg-danger-50 p-2">
          <p className="text-danger-700">unmatched</p>
          <p className="font-semibold text-danger-900">{counts.unmatched}</p>
        </div>
      </div>
    </Panel>
  );
}
