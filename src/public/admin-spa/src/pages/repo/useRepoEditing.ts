import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import type { MissionRepo } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { STATUS_CYCLE, type EditableField, type EditingCell } from './repo-options.js';
import { toErrorMessage } from '../../lib/query-client.js';

// 입력값을 저장할 값으로 바꾼다. 기수 목록이 숫자가 아니면 null
function parseFieldValue(field: EditableField, rawValue: string): string | number[] | null | undefined {
  if (field === 'cohorts') {
    const trimmed = rawValue.trim();
    if (trimmed === '') return [];
    const nums = trimmed.split(',').map((s) => Number(s.trim()));
    return nums.some(Number.isNaN) ? undefined : nums;
  }
  if (field === 'track') return rawValue === '' ? null : rawValue;
  return rawValue;
}

const comparable = (field: EditableField, value: unknown) =>
  field === 'cohorts' ? JSON.stringify((value as number[]).slice().sort()) : String(value ?? '');

// 레포 표의 칸 편집과 행 단위 변경(상태·모드 전환, 마지막 싱크 초기화, 삭제)
export function useRepoEditing() {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [savingField, setSavingField] = useState<EditingCell>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => adminApi.repos.update(id, data),
    onSuccess: () => {
      showToast('수정 완료');
      invalidate();
    },
    meta: { errorMessage: '수정 실패' },
    onSettled: () => {
      setSavingField(null);
      setEditingCell(null);
    },
  });

  const resetLastSyncAtMutation = useMutation({
    mutationFn: (id: number) => adminApi.repos.update(id, { lastSyncAt: null }),
    onSuccess: () => {
      showToast('lastSyncAt 초기화 완료');
      invalidate();
    },
    meta: { errorMessage: '초기화 실패' },
  });

  const save = useCallback(
    (repo: MissionRepo, field: EditableField, rawValue: string) => {
      const value = parseFieldValue(field, rawValue);
      if (value === undefined) {
        showToast('쉼표로 구분된 숫자를 입력하세요', 'error');
        setEditingCell(null);
        return;
      }
      if (comparable(field, repo[field]) === comparable(field, value)) {
        setEditingCell(null);
        return;
      }
      setSavingField({ repoId: repo.id, field });
      updateMutation.mutate({ id: repo.id, data: { [field]: value } });
    },
    [updateMutation],
  );

  const patchRow = async (repo: MissionRepo, data: Record<string, unknown>) => {
    try {
      await adminApi.repos.update(repo.id, data);
      invalidate();
    } catch (e) {
      showToast(toErrorMessage(e, '수정 실패'), 'error');
    }
  };

  const remove = async (repo: MissionRepo) => {
    if (!confirm(`${repo.name} 삭제하시겠습니까? 관련 submission도 삭제됩니다.`)) return;
    setDeleting(repo.id);
    try {
      await adminApi.repos.remove(repo.id);
      showToast('삭제 완료');
      invalidate();
    } catch (e) {
      showToast(toErrorMessage(e, '삭제 실패'), 'error');
    } finally {
      setDeleting(null);
    }
  };

  return {
    isEditing: (repoId: number, field: EditableField) => editingCell?.repoId === repoId && editingCell?.field === field,
    isSaving: (repoId: number, field: EditableField) => savingField?.repoId === repoId && savingField?.field === field,
    startEdit: (repoId: number, field: EditableField) => setEditingCell({ repoId, field }),
    cancel: () => setEditingCell(null),
    save,
    toggleStatus: (repo: MissionRepo) => patchRow(repo, { status: STATUS_CYCLE[repo.status] ?? 'active' }),
    toggleSyncMode: (repo: MissionRepo) =>
      patchRow(repo, { syncMode: repo.syncMode === 'continuous' ? 'once' : 'continuous' }),
    resetLastSyncAt: (repoId: number) => resetLastSyncAtMutation.mutate(repoId),
    remove,
    deleting,
  };
}

export type RepoEditing = ReturnType<typeof useRepoEditing>;
