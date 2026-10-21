import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import type { Member, MemberCohort } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { ROLE_LABELS, ROLE_OPTIONS } from './member-labels.js';

interface Props {
  member: Member;
  onChange: (member: Member | null) => void;
  onRefresh: () => void;
}

// 열 때마다 새로 그려서 기수 입력칸이 비어 있게 한다
export function MemberCohortModal({ member, onChange, onRefresh }: Props) {
  const queryClient = useQueryClient();
  const [newCohortInput, setNewCohortInput] = useState('');

  // 창은 열 때 받은 멤버를 들고 있으므로 저장 응답의 기수·역할로 바로 바꿔 보여 준다
  const applyCohorts = (updated: Member | undefined) => {
    if (updated?.cohorts) onChange({ ...member, cohorts: updated.cohorts });
  };

  const afterChange = (message: string, updated: Member | undefined) => {
    applyCohorts(updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() });
    showToast(message);
  };

  const updateCohortRolesMutation = useMutation({
    mutationFn: ({ memberId, cohort, roles }: { memberId: number; cohort: number; roles: string[] }) =>
      adminApi.members.update(memberId, { cohort, roles }),
    onSuccess: (updated) => afterChange('역할 수정 완료', updated),
    meta: { errorMessage: '역할 수정 실패' },
  });

  const deleteCohortMutation = useMutation({
    mutationFn: ({ memberId, cohort }: { memberId: number; cohort: number }) =>
      adminApi.members.removeCohort(memberId, cohort),
    onSuccess: (updated) => afterChange('기수 삭제 완료', updated),
    meta: { errorMessage: '기수 삭제 실패' },
  });

  // 서버는 cohort와 roles가 함께 와야 참여를 쓴다 (cohort만 보내면 성공 응답에 아무것도 안 바뀐다). 새 기수는 크루로 시작
  const addCohortMutation = useMutation({
    mutationFn: ({ memberId, cohort }: { memberId: number; cohort: number }) =>
      adminApi.members.update(memberId, { cohort, roles: ['crew'] }),
    onSuccess: (updated) => {
      applyCohorts(updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() });
      setNewCohortInput('');
      showToast('기수 추가 완료');
    },
    meta: { errorMessage: '기수 추가 실패' },
  });

  const handleAddCohort = () => {
    const cohort = Number(newCohortInput);
    if (!cohort || isNaN(cohort)) {
      showToast('유효한 기수를 입력하세요', 'error');
      return;
    }
    addCohortMutation.mutate({ memberId: member.id, cohort });
  };

  const toggleCohortRole = (cohort: number, currentRoles: string[], role: string) => {
    const next = currentRoles.includes(role) ? currentRoles.filter((r) => r !== role) : [...currentRoles, role];
    updateCohortRolesMutation.mutate({ memberId: member.id, cohort, roles: next });
  };

  const toggleLock = () =>
    adminApi.members.update(member.id, { cohortLocked: !member.cohortLocked }).then(() => {
      onChange({ ...member, cohortLocked: !member.cohortLocked });
      onRefresh();
    });

  return (
    <Modal open onClose={() => onChange(null)} title={`${member.githubId} 기수/역할`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded border border-base-200 bg-base-50 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-base-700">자동 산정 잠금</p>
            <p className="text-[10px] text-base-400">활성화 시 기수 자동 재산정을 건너뜁니다</p>
          </div>
          <button
            onClick={toggleLock}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${member.cohortLocked ? 'bg-primary-600' : 'bg-base-200'}`}
            title={member.cohortLocked ? '잠금 해제' : '잠금 설정'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${member.cohortLocked ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </div>
        <div>
          <p className="text-xs text-base-500 mb-2">현재 기수</p>
          {member.cohorts.length === 0 ? (
            <p className="text-xs text-base-400">기수 없음</p>
          ) : (
            <div className="space-y-1.5">
              {member.cohorts.map((c: MemberCohort) => (
                <div
                  key={c.cohort}
                  className="flex items-center gap-2 bg-base-50 border border-base-200 rounded px-2 py-1.5"
                >
                  <span className="text-xs font-semibold text-base-700 w-8">{c.cohort}기</span>
                  <div className="flex gap-1 flex-wrap">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role}
                        onClick={() => toggleCohortRole(c.cohort, c.roles, role)}
                        disabled={updateCohortRolesMutation.isPending}
                        aria-pressed={c.roles.includes(role)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${c.roles.includes(role) ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-white text-base-500 border-base-200 hover:bg-base-100'}`}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => deleteCohortMutation.mutate({ memberId: member.id, cohort: c.cohort })}
                    disabled={deleteCohortMutation.isPending}
                    className="text-[10px] text-base-400 hover:text-danger-500 ml-auto disabled:opacity-40"
                    title="기수 삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-base-500 mb-2">기수 추가</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={newCohortInput}
              onChange={(e) => setNewCohortInput(e.target.value)}
              placeholder="예: 9"
              className="border border-base-300 rounded px-2 py-1 text-xs w-20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCohort();
              }}
            />
            <Button onClick={handleAddCohort} disabled={addCohortMutation.isPending || !newCohortInput} size="xs">
              추가
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
