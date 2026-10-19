import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { Button } from '../../components/ui/Button.js';
import { Panel, SectionTitle } from '../../components/ui/Section.js';
import type { Workspace } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { Checkbox } from '../../components/ui/Field.js';

// 블로그 RSS 싱크와 프로필 새로고침: 지금 한 번 실행하는 버튼 + 정기 실행 켜기/끄기
function AutoToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 bg-base-50 border border-base-200 rounded px-3 py-1.5 cursor-pointer">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="text-xs text-base-700">{label}</span>
    </label>
  );
}

function useWorkspaceToggle(field: 'blogSyncEnabled' | 'profileRefreshEnabled') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => adminApi.workspace.update({ [field]: enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '변경 실패', 'error'),
  });
}

export function BlogSyncPanel({ workspace }: { workspace: Workspace | undefined }) {
  const queryClient = useQueryClient();
  const toggle = useWorkspaceToggle('blogSyncEnabled');
  const blogSyncMutation = useMutation({
    mutationFn: () => adminApi.blog.sync(),
    onSuccess: () => {
      showToast('블로그 싱크 작업이 큐에 추가되었습니다');
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.syncJobs() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '블로그 싱크 실패', 'error'),
  });

  return (
    <Panel variant="card">
      <SectionTitle as="h3" size="sm" className="mb-2">
        블로그
      </SectionTitle>
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => blogSyncMutation.mutate()} disabled={blogSyncMutation.isPending}>
          {blogSyncMutation.isPending ? 'RSS 싱크 중...' : 'RSS 전체 싱크'}
        </Button>
        <AutoToggle
          label="자동 싱크"
          checked={workspace?.blogSyncEnabled ?? false}
          disabled={toggle.isPending}
          onChange={(enabled) => toggle.mutate(enabled)}
        />
      </div>
    </Panel>
  );
}

export function ProfileRefreshPanel({ workspace }: { workspace: Workspace | undefined }) {
  const toggle = useWorkspaceToggle('profileRefreshEnabled');
  const profileRefreshMutation = useMutation({
    mutationFn: () => adminApi.members.refreshProfiles(),
    onSuccess: (result) => {
      showToast(`프로필 새로고침 완료 — ${result.refreshed}/${result.checked}명, 실패 ${result.failed}명`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '프로필 새로고침 실패', 'error'),
  });

  return (
    <Panel variant="card">
      <SectionTitle as="h3" size="sm" className="mb-2">
        프로필
      </SectionTitle>
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={() => profileRefreshMutation.mutate()}
          disabled={profileRefreshMutation.isPending}
          tone="success"
        >
          {profileRefreshMutation.isPending ? '프로필 새로고침 중...' : '프로필 전체 새로고침'}
        </Button>
        <AutoToggle
          label="자동 새로고침"
          checked={workspace?.profileRefreshEnabled ?? false}
          disabled={toggle.isPending}
          onChange={(enabled) => toggle.mutate(enabled)}
        />
      </div>
    </Panel>
  );
}
