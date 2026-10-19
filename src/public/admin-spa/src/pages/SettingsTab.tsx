import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../components/ui/Toast.js';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Button } from '../components/ui/Button.js';
import { Checkbox, FieldLabel, TextInput } from '../components/ui/Field.js';
import { EmptyState, SectionTitle } from '../components/ui/Section.js';

export default function SettingsTab() {
  const queryClient = useQueryClient();

  const [cohortRulesText, setCohortRulesText] = useState('');
  const [blogSyncEnabled, setBlogSyncEnabled] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newDomain, setNewDomain] = useState('');

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: queryKeys.workspace(),
    queryFn: () => adminApi.workspace.get(),
    staleTime: 300_000,
  });

  // Sync local state when workspace loads
  const [workspaceInitialized, setWorkspaceInitialized] = useState(false);
  if (workspace && !workspaceInitialized) {
    setCohortRulesText(JSON.stringify(workspace.cohortRules, null, 2));
    setBlogSyncEnabled(workspace.blogSyncEnabled);
    setWorkspaceInitialized(true);
  }

  const { data: bannedWords = [] } = useQuery({
    queryKey: queryKeys.bannedWords(),
    queryFn: () => adminApi.bannedWords.list(),
  });

  const { data: ignoredDomains = [] } = useQuery({
    queryKey: queryKeys.ignoredDomains(),
    queryFn: () => adminApi.ignoredDomains.list(),
  });

  const saveWorkspaceMutation = useMutation({
    mutationFn: (payload: { cohortRules?: Record<string, number>; blogSyncEnabled?: boolean }) =>
      adminApi.workspace.update(payload),
    onSuccess: () => {
      showToast('저장 완료');
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '저장 실패', 'error'),
  });

  const toggleBlogSync = (enabled: boolean) => {
    setBlogSyncEnabled(enabled);
    saveWorkspaceMutation.mutate({ blogSyncEnabled: enabled });
  };

  const addBannedWordMutation = useMutation({
    mutationFn: (word: string) => adminApi.bannedWords.create(word),
    onSuccess: () => {
      setNewWord('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.bannedWords() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '추가 실패', 'error'),
  });

  const deleteBannedWordMutation = useMutation({
    mutationFn: (id: number) => adminApi.bannedWords.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bannedWords() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '삭제 실패', 'error'),
  });

  const addIgnoredDomainMutation = useMutation({
    mutationFn: (domain: string) => adminApi.ignoredDomains.create(domain),
    onSuccess: () => {
      setNewDomain('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.ignoredDomains() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '추가 실패', 'error'),
  });

  const deleteIgnoredDomainMutation = useMutation({
    mutationFn: (id: number) => adminApi.ignoredDomains.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ignoredDomains() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '삭제 실패', 'error'),
  });

  const saveWorkspace = (e: FormEvent) => {
    e.preventDefault();
    try {
      const cohortRules = JSON.parse(cohortRulesText) as Record<string, number>;
      saveWorkspaceMutation.mutate({ cohortRules, blogSyncEnabled });
    } catch {
      showToast('JSON 형식 오류', 'error');
    }
  };

  const addBannedWord = (e: FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    addBannedWordMutation.mutate(newWord.trim());
  };

  const addIgnoredDomain = (e: FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    addIgnoredDomainMutation.mutate(newDomain.trim());
  };

  if (workspaceLoading) {
    return <EmptyState>로딩 중...</EmptyState>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <SectionTitle className="mb-3">워크스페이스</SectionTitle>
        <form onSubmit={saveWorkspace} className="space-y-3 bg-base-50 border border-base-200 rounded p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={blogSyncEnabled}
              onChange={(e) => toggleBlogSync(e.target.checked)}
              disabled={saveWorkspaceMutation.isPending}
            />
            <span className="text-sm text-base-700">블로그 RSS 자동 싱크</span>
            {saveWorkspaceMutation.isPending && <span className="text-xs text-base-400">저장 중...</span>}
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
          <Button type="submit" disabled={saveWorkspaceMutation.isPending}>
            {saveWorkspaceMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </form>
      </section>

      <section>
        <SectionTitle className="mb-3">금지어 ({bannedWords.length})</SectionTitle>
        <form onSubmit={addBannedWord} className="flex gap-2 mb-3">
          <TextInput
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="추가할 금지어"
            className="flex-1"
          />
          <Button type="submit" disabled={addBannedWordMutation.isPending || !newWord.trim()} tone="neutral" size="md">
            추가
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {bannedWords.map((w) => (
            <span
              key={w.id}
              className="inline-flex items-center gap-1 bg-danger-50 border border-danger-200 text-danger-700 text-xs rounded px-2 py-1"
            >
              {w.word}
              <button onClick={() => deleteBannedWordMutation.mutate(w.id)} className="hover:text-danger-900 ml-0.5">
                ✕
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle className="mb-3">무시 도메인 ({ignoredDomains.length})</SectionTitle>
        <form onSubmit={addIgnoredDomain} className="flex gap-2 mb-3">
          <TextInput
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="예: example.com"
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={addIgnoredDomainMutation.isPending || !newDomain.trim()}
            tone="neutral"
            size="md"
          >
            추가
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {ignoredDomains.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 bg-base-100 border border-base-300 text-base-700 text-xs rounded px-2 py-1"
            >
              {d.domain}
              <button onClick={() => deleteIgnoredDomainMutation.mutate(d.id)} className="hover:text-base-900 ml-0.5">
                ✕
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
