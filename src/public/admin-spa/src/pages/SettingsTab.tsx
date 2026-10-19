import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../components/ui/Toast.js';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';

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
    return <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">워크스페이스</h2>
        <form onSubmit={saveWorkspace} className="space-y-3 bg-gray-50 border border-gray-200 rounded p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={blogSyncEnabled}
              onChange={(e) => toggleBlogSync(e.target.checked)}
              disabled={saveWorkspaceMutation.isPending}
              className="rounded"
            />
            <span className="text-sm text-gray-700">블로그 RSS 자동 싱크</span>
            {saveWorkspaceMutation.isPending && <span className="text-xs text-gray-400">저장 중...</span>}
          </label>
          <div>
            <label className="text-xs text-gray-500 block mb-1">기수 규칙 (JSON)</label>
            <textarea
              value={cohortRulesText}
              onChange={(e) => setCohortRulesText(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={saveWorkspaceMutation.isPending}
            className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
          >
            {saveWorkspaceMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">금지어 ({bannedWords.length})</h2>
        <form onSubmit={addBannedWord} className="flex gap-2 mb-3">
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="추가할 금지어"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1"
          />
          <button
            type="submit"
            disabled={addBannedWordMutation.isPending || !newWord.trim()}
            className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40"
          >
            추가
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {bannedWords.map((w) => (
            <span
              key={w.id}
              className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1"
            >
              {w.word}
              <button onClick={() => deleteBannedWordMutation.mutate(w.id)} className="hover:text-red-900 ml-0.5">
                ✕
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">무시 도메인 ({ignoredDomains.length})</h2>
        <form onSubmit={addIgnoredDomain} className="flex gap-2 mb-3">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="예: example.com"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1"
          />
          <button
            type="submit"
            disabled={addIgnoredDomainMutation.isPending || !newDomain.trim()}
            className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40"
          >
            추가
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {ignoredDomains.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 text-gray-700 text-xs rounded px-2 py-1"
            >
              {d.domain}
              <button onClick={() => deleteIgnoredDomainMutation.mutate(d.id)} className="hover:text-gray-900 ml-0.5">
                ✕
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
