import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { useEventStreamLog } from '../../hooks/useEventStreamLog.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';

type EnqueueParams = { type: 'workspace' | 'continuous' | 'cohort-repos'; cohort?: number };

// 싱크 작업을 큐에 넣고 진행 로그를 따라간다. 끝나면 큐 목록을, 정상 완료면 상태(onDone)도 다시 읽는다
export function useSyncJobStream(onDone: () => void) {
  const queryClient = useQueryClient();
  const { running, logs, logEndRef, follow, stop } = useEventStreamLog();
  const invalidateQueue = () => void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });

  const enqueueMutation = useMutation({
    mutationFn: (params: EnqueueParams) => adminApi.sync.createJob(params),
    onSuccess: (result) => {
      invalidateQueue();
      showToast('작업이 큐에 추가되었습니다');
      follow(`/admin/sync/jobs/${result.id}/stream`, `작업 ${result.id} 시작 대기 중`, (end) => {
        if (end === 'done') onDone();
        invalidateQueue();
      });
    },
    meta: { errorMessage: '큐 추가 실패' },
  });

  return {
    running,
    logs,
    logEndRef,
    stop,
    enqueue: (params: EnqueueParams) => enqueueMutation.mutate(params),
    isEnqueuing: enqueueMutation.isPending,
  };
}
