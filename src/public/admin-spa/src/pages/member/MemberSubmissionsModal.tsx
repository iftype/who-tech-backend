import { useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { Modal } from '../../components/ui/Modal.js';
import { Badge } from '../../components/ui/Badge.js';
import type { Member, Submission } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { TextLink } from '../../components/ui/TextLink.js';
import { toErrorMessage } from '../../lib/query-client.js';
import { confirmAction } from '../../components/ui/ConfirmDialog.js';

export interface SubmissionsModalState {
  member: Member;
  submissions: Submission[];
}

interface Props {
  state: SubmissionsModalState | null;
  onChange: (state: SubmissionsModalState | null) => void;
  onRefresh: () => void;
}

export function MemberSubmissionsModal({ state, onChange, onRefresh }: Props) {
  const queryClient = useQueryClient();

  const removeSubmission = async (s: Submission) => {
    if (!state) return;
    if (
      !(await confirmAction(`PR #${s.prNumber} ${s.title}을(를) 삭제하시겠습니까?`, {
        confirmLabel: '삭제',
        danger: true,
      }))
    )
      return;
    adminApi.members
      .removeSubmission(state.member.id, s.id)
      .then(() => {
        showToast('PR 삭제 완료');
        onChange({ member: state.member, submissions: state.submissions.filter((sub) => sub.id !== s.id) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() });
        onRefresh();
      })
      .catch((e) => showToast(toErrorMessage(e, '삭제 실패'), 'error'));
  };

  return (
    <Modal
      open={!!state}
      onClose={() => onChange(null)}
      title={`${state?.member.nickname ?? state?.member.githubId} 제출 내역`}
    >
      {state && (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {state.submissions.length === 0 ? (
            <p className="text-base-400 text-sm">제출 내역 없음</p>
          ) : (
            state.submissions.map((s) => (
              <div key={s.id} className="border border-base-100 rounded p-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TextLink href={s.prUrl} target="_blank" rel="noopener noreferrer" size="sm">
                      #{s.prNumber} {s.title}
                    </TextLink>
                    <Badge tone={s.status === 'merged' ? 'accent' : s.status === 'open' ? 'success' : 'base'}>
                      {s.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-base-400 mt-0.5">
                    {s.missionRepo.name} · {new Date(s.submittedAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <button
                  onClick={() => void removeSubmission(s)}
                  className="text-xs text-base-400 hover:text-danger-500 px-1"
                  title="PR 삭제"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
