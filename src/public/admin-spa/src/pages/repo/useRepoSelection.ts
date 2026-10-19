import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';

// 레포 체크 선택과 선택한 레포의 트랙 일괄 변경
export function useRepoSelection() {
  const queryClient = useQueryClient();
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set());
  const [batchTrackValue, setBatchTrackValue] = useState('');

  const batchTrackMutation = useMutation({
    mutationFn: async ({ ids, track }: { ids: number[]; track: string | null }) => {
      await Promise.all(ids.map((id) => adminApi.repos.update(id, { track })));
    },
    onSuccess: () => {
      showToast('일괄 변경 완료');
      setSelectedRepoIds(new Set());
      setBatchTrackValue('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
    },
    onError: (e) => {
      showToast(e instanceof Error ? e.message : '일괄 변경 실패', 'error');
    },
  });

  const toggle = useCallback((repoId: number) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) next.delete(repoId);
      else next.add(repoId);
      return next;
    });
  }, []);

  // 모두 선택돼 있으면 해제, 아니면 모두 선택
  const toggleAll = useCallback((repoIds: number[], allSelected: boolean) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      repoIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }, []);

  const applyBatchTrack = () => {
    const ids = Array.from(selectedRepoIds);
    if (ids.length === 0) {
      showToast('선택된 레포가 없습니다', 'error');
      return;
    }
    batchTrackMutation.mutate({ ids, track: batchTrackValue === '' ? null : batchTrackValue });
  };

  return {
    selectedRepoIds,
    toggle,
    toggleAll,
    clear: () => setSelectedRepoIds(new Set()),
    batchTrackValue,
    setBatchTrackValue,
    applyBatchTrack,
    isApplying: batchTrackMutation.isPending,
  };
}

export type RepoSelection = ReturnType<typeof useRepoSelection>;
