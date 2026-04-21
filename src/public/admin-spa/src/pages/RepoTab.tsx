import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { MissionRepo } from '../lib/types.js';

type StatusFilter = '' | 'active' | 'candidate' | 'excluded';
type TabCategoryFilter = '' | 'base' | 'common' | 'precourse' | 'excluded';

export default function RepoTab() {
  const [status, setStatus] = useState<StatusFilter>('');
  const [tabCategory, setTabCategory] = useState<TabCategoryFilter>('');
  const [syncing, setSyncing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: repos = [], isLoading } = useQuery({
    queryKey: ['repos', status],
    queryFn: () => {
      const params = status ? `?status=${status}` : '';
      return apiFetch<MissionRepo[]>(`/admin/repos${params}`);
    },
  });

  const filteredRepos = tabCategory
    ? repos.filter((r) => r.tabCategory === tabCategory)
    : repos;

  const discoverMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ discovered: number; created: number; updated: number }>(
        '/admin/repos/discover',
        { method: 'POST' },
      ),
    onSuccess: (result) => {
      showToast(
        `탐색 완료 — ${result.discovered}개 발견, ${result.created}개 생성, ${result.updated}개 갱신`,
      );
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '탐색 실패', 'error'),
  });

  const syncRepo = async (repo: MissionRepo) => {
    setSyncing(repo.id);
    try {
      await apiFetch(`/admin/repos/${repo.id}/sync`, { method: 'POST' });
      showToast(`${repo.name} 싱크 완료`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '싱크 실패', 'error');
    } finally {
      setSyncing(null);
    }
  };

  const toggleStatus = async (repo: MissionRepo) => {
    const newStatus = repo.status === 'active' ? 'excluded' : 'active';
    try {
      await apiFetch(`/admin/repos/${repo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '수정 실패', 'error');
    }
  };

  const toggleSyncMode = async (repo: MissionRepo) => {
    const newMode = repo.syncMode === 'continuous' ? 'once' : 'continuous';
    try {
      await apiFetch(`/admin/repos/${repo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ syncMode: newMode }),
      });
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '수정 실패', 'error');
    }
  };

  const deleteRepo = async (repo: MissionRepo) => {
    if (!confirm(`${repo.name} 삭제하시겠습니까? 관련 submission도 삭제됩니다.`)) return;
    setDeleting(repo.id);
    try {
      await apiFetch(`/admin/repos/${repo.id}`, { method: 'DELETE' });
      showToast('삭제 완료');
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700 border-green-200',
      candidate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      excluded: 'bg-red-100 text-red-700 border-red-200',
    };
    return (
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${colors[s] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
      >
        {s}
      </span>
    );
  };

  const tabCategoryBadge = (c: string) => {
    const labels: Record<string, string> = {
      base: '기준',
      common: '공통',
      precourse: '프리코스',
      excluded: '제외',
    };
    const colors: Record<string, string> = {
      base: 'bg-blue-50 text-blue-700 border-blue-200',
      common: 'bg-purple-50 text-purple-700 border-purple-200',
      precourse: 'bg-orange-50 text-orange-700 border-orange-200',
      excluded: 'bg-gray-100 text-gray-500 border-gray-200',
    };
    return (
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${colors[c] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
      >
        {labels[c] ?? c}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['', 'active', 'candidate', 'excluded'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs px-3 py-1.5 rounded border ${
                status === s
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {s || '전체 상태'}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['', 'base', 'common', 'precourse', 'excluded'] as TabCategoryFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setTabCategory(c)}
              className={`text-xs px-3 py-1.5 rounded border ${
                tabCategory === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {c ? tabCategoryBadge(c) : '전체 카테고리'}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400">{filteredRepos.length}개</span>
        <button
          onClick={() => discoverMutation.mutate()}
          disabled={discoverMutation.isPending}
          className="ml-auto bg-purple-600 text-white text-sm rounded px-3 py-1.5 hover:bg-purple-700 disabled:opacity-40"
        >
          {discoverMutation.isPending ? '탐색 중...' : '레포 탐색'}
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">레포</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">트랙</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">타입</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">카테고리</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">상태</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">모드</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Lv</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">기수</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">제출</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRepos.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <a
                      href={r.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      {r.name}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.track ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.type === 'integration' ? '통합' : '개인'}</td>
                  <td className="px-3 py-2">{tabCategoryBadge(r.tabCategory)}</td>
                  <td className="px-3 py-2">{statusBadge(r.status)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => void toggleSyncMode(r)}
                      title="클릭하여 전환"
                      className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                        r.syncMode === 'continuous'
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {r.syncMode === 'continuous' ? '연속' : '1회'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.level ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.cohorts.join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r._count.submissions}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => void syncRepo(r)}
                        disabled={syncing === r.id}
                        className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-40 px-1"
                        title="싱크"
                      >
                        {syncing === r.id ? '⟳' : '↺'}
                      </button>
                      {r.status === 'candidate' ? (
                        <button
                          onClick={() => void toggleStatus(r)}
                          className="text-xs text-green-600 hover:text-green-700 px-1 font-medium"
                          title="active로 승인"
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          onClick={() => void toggleStatus(r)}
                          className="text-xs text-gray-500 hover:text-green-600 px-1"
                          title={r.status === 'active' ? '제외' : '활성화'}
                        >
                          {r.status === 'active' ? '⏸' : '▶'}
                        </button>
                      )}
                      <button
                        onClick={() => void deleteRepo(r)}
                        disabled={deleting === r.id}
                        className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 px-1"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRepos.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">레포 없음</div>
          )}
        </div>
      )}
    </div>
  );
}
