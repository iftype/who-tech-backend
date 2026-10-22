import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState, ErrorState } from '../components/ui/Section.js';
import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { TagListEditor } from './settings/TagListEditor.js';
import { WorkspaceForm } from './settings/WorkspaceForm.js';

export default function SettingsTab() {
  const queryClient = useQueryClient();

  const {
    data: workspace,
    isLoading: workspaceLoading,
    isError: workspaceError,
    refetch: refetchWorkspace,
  } = useQuery({
    queryKey: queryKeys.workspace(),
    queryFn: () => adminApi.workspace.get(),
    staleTime: 300_000,
  });

  const { data: bannedWords = [] } = useQuery({
    queryKey: queryKeys.bannedWords(),
    queryFn: () => adminApi.bannedWords.list(),
  });

  const { data: ignoredDomains = [] } = useQuery({
    queryKey: queryKeys.ignoredDomains(),
    queryFn: () => adminApi.ignoredDomains.list(),
  });

  const invalidate = (queryKey: readonly unknown[]) => void queryClient.invalidateQueries({ queryKey });

  const addBannedWord = useMutation({
    mutationFn: ({ value }: { value: string; done: () => void }) => adminApi.bannedWords.create(value),
    onSuccess: (_data, { done }) => {
      done();
      invalidate(queryKeys.bannedWords());
    },
    meta: { errorMessage: '추가 실패' },
  });
  const removeBannedWord = useMutation({
    mutationFn: (id: number) => adminApi.bannedWords.remove(id),
    onSuccess: () => invalidate(queryKeys.bannedWords()),
    meta: { errorMessage: '삭제 실패' },
  });
  const addIgnoredDomain = useMutation({
    mutationFn: ({ value }: { value: string; done: () => void }) => adminApi.ignoredDomains.create(value),
    onSuccess: (_data, { done }) => {
      done();
      invalidate(queryKeys.ignoredDomains());
    },
    meta: { errorMessage: '추가 실패' },
  });
  const removeIgnoredDomain = useMutation({
    mutationFn: (id: number) => adminApi.ignoredDomains.remove(id),
    onSuccess: () => invalidate(queryKeys.ignoredDomains()),
    meta: { errorMessage: '삭제 실패' },
  });

  if (workspaceLoading) {
    return <EmptyState>로딩 중...</EmptyState>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {workspace ? (
        <WorkspaceForm workspace={workspace} />
      ) : (
        workspaceError && <ErrorState onRetry={() => void refetchWorkspace()} />
      )}
      <TagListEditor
        title="금지어"
        placeholder="추가할 금지어"
        tone="danger"
        items={bannedWords.map((w) => ({ id: w.id, label: w.word }))}
        onAdd={(value, done) => addBannedWord.mutate({ value, done })}
        onRemove={(id) => removeBannedWord.mutate(id)}
        adding={addBannedWord.isPending}
      />
      <TagListEditor
        title="무시 도메인"
        placeholder="예: example.com"
        tone="base"
        items={ignoredDomains.map((d) => ({ id: d.id, label: d.domain }))}
        onAdd={(value, done) => addIgnoredDomain.mutate({ value, done })}
        onRemove={(id) => removeIgnoredDomain.mutate(id)}
        adding={addIgnoredDomain.isPending}
      />
    </div>
  );
}
