import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import type { CohortRepo } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { confirmAction } from '../../components/ui/ConfirmDialog.js';

// 기수 레포의 순서·레벨 칸 편집(Enter 저장, Esc 취소, 값이 같으면 저장 생략)과 삭제
export function useCohortRepoEditor() {
  const queryClient = useQueryClient();
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingOrderValue, setEditingOrderValue] = useState('');
  const orderInputRef = useRef<HTMLInputElement>(null);
  const [editingLevelId, setEditingLevelId] = useState<number | null>(null);
  const [editingLevelValue, setEditingLevelValue] = useState('');
  const levelInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.cohortRepos.all() });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.cohortRepos.remove(id),
    onSuccess: () => {
      showToast('삭제 완료');
      invalidate();
    },
    meta: { errorMessage: '삭제 실패' },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, order }: { id: number; order: number }) => adminApi.cohortRepos.update(id, { order }),
    onSuccess: () => {
      setEditingOrderId(null);
      invalidate();
    },
    meta: { errorMessage: '순서 변경 실패' },
    onError: () => {
      setEditingOrderId(null);
    },
  });

  const updateLevelMutation = useMutation({
    mutationFn: ({ id, level }: { id: number; level: number | null }) => adminApi.cohortRepos.update(id, { level }),
    onSuccess: () => {
      setEditingLevelId(null);
      invalidate();
    },
    meta: { errorMessage: '레벨 변경 실패' },
    onError: () => {
      setEditingLevelId(null);
    },
  });

  const saveOrder = (cr: CohortRepo) => {
    const newOrder = Number(editingOrderValue);
    if (isNaN(newOrder)) {
      showToast('숫자를 입력하세요', 'error');
      return;
    }
    if (newOrder === cr.order) {
      setEditingOrderId(null);
      return;
    }
    updateOrderMutation.mutate({ id: cr.id, order: newOrder });
  };

  const saveLevel = (cr: CohortRepo) => {
    const raw = editingLevelValue.trim();
    const newLevel = raw === '' ? null : Number(raw);
    if (raw !== '' && isNaN(newLevel as number)) {
      showToast('숫자를 입력하세요', 'error');
      return;
    }
    if (newLevel === cr.level) {
      setEditingLevelId(null);
      return;
    }
    updateLevelMutation.mutate({ id: cr.id, level: newLevel });
  };

  useEffect(() => {
    if (editingOrderId != null) {
      setTimeout(() => orderInputRef.current?.focus(), 0);
    }
  }, [editingOrderId]);

  useEffect(() => {
    if (editingLevelId != null) {
      setTimeout(() => levelInputRef.current?.focus(), 0);
    }
  }, [editingLevelId]);

  return {
    order: {
      editingId: editingOrderId,
      value: editingOrderValue,
      inputRef: orderInputRef,
      setValue: setEditingOrderValue,
      start: (cr: CohortRepo) => {
        setEditingOrderId(cr.id);
        setEditingOrderValue(String(cr.order));
      },
      save: saveOrder,
      cancel: () => setEditingOrderId(null),
    },
    level: {
      editingId: editingLevelId,
      value: editingLevelValue,
      inputRef: levelInputRef,
      setValue: setEditingLevelValue,
      start: (cr: CohortRepo) => {
        setEditingLevelId(cr.id);
        setEditingLevelValue(cr.level != null ? String(cr.level) : '');
      },
      save: saveLevel,
      cancel: () => setEditingLevelId(null),
    },
    remove: async (cr: CohortRepo) => {
      if (await confirmAction(`${cr.missionRepo.name}을(를) 삭제하시겠습니까?`, { confirmLabel: '삭제', danger: true }))
        deleteMutation.mutate(cr.id);
    },
    isRemoving: deleteMutation.isPending,
  };
}

export type CohortRepoEditor = ReturnType<typeof useCohortRepoEditor>;
export type CohortRepoFieldEditor = CohortRepoEditor['order'];
