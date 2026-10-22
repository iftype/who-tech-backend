import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../components/ui/Button.js';
import { Checkbox, FieldLabel } from '../../components/ui/Field.js';
import { SectionTitle } from '../../components/ui/Section.js';
import { showToast } from '../../components/ui/Toast.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import type { Workspace } from '../../lib/types.js';

// 블로그 자동 싱크 토글(즉시 저장)과 기수 규칙 JSON 편집(저장 버튼). 처음 값은 불러온 워크스페이스에서 한 번만 복사한다
export function WorkspaceForm({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const [cohortRulesText, setCohortRulesText] = useState(() => JSON.stringify(workspace.cohortRules, null, 2));
  const [blogSyncEnabled, setBlogSyncEnabled] = useState(workspace.blogSyncEnabled);

  const saveMutation = useMutation({
    mutationFn: (payload: { cohortRules?: Record<string, number>; blogSyncEnabled?: boolean }) =>
      adminApi.workspace.update(payload),
    onSuccess: () => {
      showToast('저장 완료');
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace() });
    },
    meta: { errorMessage: '저장 실패' },
  });

  const toggleBlogSync = (enabled: boolean) => {
    setBlogSyncEnabled(enabled);
    saveMutation.mutate({ blogSyncEnabled: enabled });
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    try {
      const cohortRules = JSON.parse(cohortRulesText) as Record<string, number>;
      saveMutation.mutate({ cohortRules, blogSyncEnabled });
    } catch {
      showToast('JSON 형식 오류', 'error');
    }
  };

  return (
    <section>
      <SectionTitle className="mb-3">워크스페이스</SectionTitle>
      <form onSubmit={save} className="space-y-3 bg-base-50 border border-base-200 rounded p-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={blogSyncEnabled}
            onChange={(e) => toggleBlogSync(e.target.checked)}
            disabled={saveMutation.isPending}
          />
          <span className="text-sm text-base-700">블로그 RSS 자동 싱크</span>
          {saveMutation.isPending && <span className="text-xs text-base-400">저장 중...</span>}
        </label>
        <div>
          <FieldLabel>기수 규칙 (JSON)</FieldLabel>
          <textarea
            value={cohortRulesText}
            onChange={(e) => setCohortRulesText(e.target.value)}
            rows={6}
            className="w-full border border-base-300 rounded px-3 py-2 text-xs font-mono"
          />
        </div>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </form>
    </section>
  );
}
