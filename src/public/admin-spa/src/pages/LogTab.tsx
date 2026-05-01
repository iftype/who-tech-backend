import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { ActivityLog } from '../lib/types.js';

type LogCategory = 'all' | 'repo' | 'blog';

export default function LogTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<LogCategory>('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => apiFetch<ActivityLog[]>('/admin/logs'),
  });

  const clearMutation = useMutation({
    mutationFn: () => apiFetch('/admin/logs', { method: 'DELETE' }),
    onSuccess: () => {
      showToast('로그 삭제 완료');
      void queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '삭제 실패', 'error'),
  });

  const filtered = logs.filter((l) => {
    if (category === 'repo') return l.type.includes('sync') || l.type.includes('repo');
    if (category === 'blog') return l.type.includes('blog');
    return true;
  }).filter((l) => {
    if (!filter) return true;
    return l.type.includes(filter) || l.message.includes(filter);
  });

  const logColor = (type: string) => {
    if (type.includes('error')) return 'text-red-400';
    if (type.includes('sync')) return 'text-blue-400';
    if (type.includes('blog')) return 'text-green-400';
    return 'text-gray-300';
  };

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
      active ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 rounded p-0.5">
            <button onClick={() => setCategory('all')} className={tabClass(category === 'all')}>
              전체
            </button>
            <button onClick={() => setCategory('repo')} className={tabClass(category === 'repo')}>
              레포 싱크
            </button>
            <button onClick={() => setCategory('blog')} className={tabClass(category === 'blog')}>
              블로그 싱크
            </button>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="타입/메시지 필터"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
          <span className="text-xs text-gray-400">{filtered.length}개</span>
        </div>
        <button
          onClick={() => {
            if (confirm('전체 로그를 삭제하시겠습니까?')) clearMutation.mutate();
          }}
          className="text-xs text-red-500 hover:text-red-600 border border-red-200 rounded px-3 py-1.5 hover:bg-red-50"
        >
          전체 삭제
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
      ) : (
        <div className="bg-gray-900 rounded border border-gray-700 p-4 font-mono text-xs max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-gray-500 py-4">로그 없음</div>
          ) : (
            filtered.map((l) => (
              <div key={l.id} className={`${logColor(l.type)} leading-5`}>
                <span className="text-gray-600 mr-2">
                  {new Date(l.createdAt).toLocaleString('ko-KR')}
                </span>
                <span className="text-gray-500 mr-2">[{l.type}]</span>
                {l.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
