import { useState, useEffect, type FormEvent } from 'react';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { Workspace, BannedWord, IgnoredDomain } from '../lib/types.js';

export default function SettingsTab() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [blogSyncEnabled, setBlogSyncEnabled] = useState(false);
  const [cohortRulesText, setCohortRulesText] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);
  const [newWord, setNewWord] = useState('');
  const [addingWord, setAddingWord] = useState(false);

  const [ignoredDomains, setIgnoredDomains] = useState<IgnoredDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  useEffect(() => {
    void Promise.all([
      apiFetch<Workspace>('/admin/workspace').then((w) => {
        setWorkspace(w);
        setBlogSyncEnabled(w.blogSyncEnabled);
        setCohortRulesText(JSON.stringify(w.cohortRules, null, 2));
      }),
      apiFetch<BannedWord[]>('/admin/banned-words').then(setBannedWords),
      apiFetch<IgnoredDomain[]>('/admin/ignored-domains').then(setIgnoredDomains),
    ]).catch(() => showToast('설정 로딩 실패', 'error'));
  }, []);

  const saveWorkspace = async (e: FormEvent) => {
    e.preventDefault();
    setSavingWorkspace(true);
    try {
      const cohortRules = JSON.parse(cohortRulesText) as Record<string, number>;
      const updated = await apiFetch<Workspace>('/admin/workspace', {
        method: 'PUT',
        body: JSON.stringify({ cohortRules, blogSyncEnabled }),
      });
      setWorkspace(updated);
      showToast('저장 완료');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '저장 실패', 'error');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const addBannedWord = async (e: FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    setAddingWord(true);
    try {
      const w = await apiFetch<BannedWord>('/admin/banned-words', {
        method: 'POST',
        body: JSON.stringify({ word: newWord.trim() }),
      });
      setBannedWords((prev) => [...prev, w]);
      setNewWord('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '추가 실패', 'error');
    } finally {
      setAddingWord(false);
    }
  };

  const deleteBannedWord = async (id: number) => {
    try {
      await apiFetch(`/admin/banned-words/${id}`, { method: 'DELETE' });
      setBannedWords((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'error');
    }
  };

  const addIgnoredDomain = async (e: FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    try {
      const d = await apiFetch<IgnoredDomain>('/admin/ignored-domains', {
        method: 'POST',
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      setIgnoredDomains((prev) => [...prev, d]);
      setNewDomain('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '추가 실패', 'error');
    } finally {
      setAddingDomain(false);
    }
  };

  const deleteIgnoredDomain = async (id: number) => {
    try {
      await apiFetch(`/admin/ignored-domains/${id}`, { method: 'DELETE' });
      setIgnoredDomains((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'error');
    }
  };

  if (!workspace) {
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
              onChange={(e) => setBlogSyncEnabled(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">블로그 RSS 싱크 활성화</span>
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
            disabled={savingWorkspace}
            className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
          >
            {savingWorkspace ? '저장 중...' : '저장'}
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
            disabled={addingWord || !newWord.trim()}
            className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40"
          >
            추가
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {bannedWords.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1">
              {w.word}
              <button onClick={() => void deleteBannedWord(w.id)} className="hover:text-red-900 ml-0.5">✕</button>
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
            disabled={addingDomain || !newDomain.trim()}
            className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40"
          >
            추가
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {ignoredDomains.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 text-gray-700 text-xs rounded px-2 py-1">
              {d.domain}
              <button onClick={() => void deleteIgnoredDomain(d.id)} className="hover:text-gray-900 ml-0.5">✕</button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
