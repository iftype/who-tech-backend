import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import type { Member } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';

export type EditableMemberField = 'manualNickname' | 'blog' | 'track';

// 멤버 표의 칸 단위 편집. 한 번에 한 칸만 편집하고, 칸 밖을 누르거나 Enter면 저장, Esc면 취소
export function useMemberInlineEdit() {
  const queryClient = useQueryClient();
  const [editCell, setEditCell] = useState<{ memberId: number; field: EditableMemberField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: number; data: Record<string, unknown> }) =>
      adminApi.members.update(memberId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() });
      showToast('수정 완료');
      setEditCell(null);
    },
    meta: { errorMessage: '수정 실패' },
  });

  const startEdit = useCallback((member: Member, field: EditableMemberField) => {
    setEditCell({ memberId: member.id, field });
    if (field === 'manualNickname') setEditValue(member.manualNickname ?? '');
    else if (field === 'blog') setEditValue(member.blog ?? '');
    else if (field === 'track') setEditValue(member.track ?? '');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editCell) return;
    const data: Record<string, unknown> = {};
    if (editCell.field === 'track') data.track = editValue || null;
    else data[editCell.field] = editValue || null;
    updateMemberMutation.mutate({ memberId: editCell.memberId, data });
  }, [editCell, editValue, updateMemberMutation]);

  const cancelEdit = useCallback(() => {
    setEditCell(null);
    setEditValue('');
  }, []);

  useEffect(() => {
    if (!editCell) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) saveEdit();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editCell, saveEdit]);

  useEffect(() => {
    if (editCell?.field === 'manualNickname' || editCell?.field === 'blog') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (editCell?.field === 'track') selectRef.current?.focus();
  }, [editCell]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return {
    editValue,
    setEditValue,
    inputRef,
    selectRef,
    containerRef,
    isEditing: (memberId: number, field: EditableMemberField) =>
      editCell?.memberId === memberId && editCell.field === field,
    startEdit,
    handleKeyDown,
    // 트랙은 고르는 즉시 저장한다
    saveNow: (memberId: number, data: Record<string, unknown>) => updateMemberMutation.mutate({ memberId, data }),
    isSaving: updateMemberMutation.isPending,
  };
}

export type MemberInlineEdit = ReturnType<typeof useMemberInlineEdit>;
