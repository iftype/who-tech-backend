import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../components/ui/Toast.js';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { EmptyState, ErrorState } from '../components/ui/Section.js';
import { TextInput } from '../components/ui/Field.js';

type LogCategory = 'all' | 'repo' | 'blog' | 'refresh';

export default function LogTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<LogCategory>('all');

  const {
    data: logs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.activityLogs(),
    queryFn: () => adminApi.logs.list(),
  });

  const clearMutation = useMutation({
    mutationFn: () => adminApi.logs.clear(),
    onSuccess: () => {
      showToast('로그 삭제 완료');
      void queryClient.invalidateQueries({ queryKey: queryKeys.activityLogs() });
    },
    meta: { errorMessage: '삭제 실패' },
  });

  const filtered = logs
    .filter((l) => {
      if (category === 'repo') return l.type.includes('sync') || l.type.includes('repo');
      if (category === 'blog') return l.type.includes('blog');
      if (category === 'refresh') return l.type.includes('refresh') || l.type.includes('rate_limit_member');
      return true;
    })
    .filter((l) => {
      if (!filter) return true;
      return l.type.includes(filter) || l.message.includes(filter);
    });

  const logColor = (type: string) => {
    if (type.includes('error')) return 'text-danger-400';
    if (type.includes('sync') && !type.includes('blog')) return 'text-primary-400';
    if (type.includes('blog')) return 'text-success-400';
    if (type.includes('refresh')) return 'text-accent-400';
    if (type.includes('rate_limit')) return 'text-highlight-400';
    return 'text-base-300';
  };

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
      active ? 'bg-primary-100 text-primary-700' : 'text-base-500 hover:bg-base-100'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-base-50 rounded p-0.5">
            <button onClick={() => setCategory('all')} className={tabClass(category === 'all')}>
              전체
            </button>
            <button onClick={() => setCategory('repo')} className={tabClass(category === 'repo')}>
              레포 싱크
            </button>
            <button onClick={() => setCategory('blog')} className={tabClass(category === 'blog')}>
              블로그 싱크
            </button>
            <button onClick={() => setCategory('refresh')} className={tabClass(category === 'refresh')}>
              프로필 새로고침
            </button>
          </div>
          <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="타입/메시지 필터" />
          <span className="text-xs text-base-400">{filtered.length}개</span>
        </div>
        <button
          onClick={() => {
            if (confirm('전체 로그를 삭제하시겠습니까?')) clearMutation.mutate();
          }}
          className="text-xs text-danger-500 hover:text-danger-600 border border-danger-200 rounded px-3 py-1.5 hover:bg-danger-50"
        >
          전체 삭제
        </button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <EmptyState>로딩 중...</EmptyState>
      ) : (
        <div className="bg-base-900 rounded border border-base-700 p-4 font-mono text-xs max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-base-500 py-4">로그 없음</div>
          ) : (
            filtered.map((l) => (
              <div key={l.id} className={`${logColor(l.type)} leading-5`}>
                <span className="text-base-600 mr-2">{new Date(l.createdAt).toLocaleString('ko-KR')}</span>
                <span className="text-base-500 mr-2">[{l.type}]</span>
                {l.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
