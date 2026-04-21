import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { NewBlogPost } from '../lib/types.js';

export default function BlogTab() {
  const [sinceMinutes, setSinceMinutes] = useState(65);
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-new-posts', sinceMinutes],
    queryFn: () => apiFetch<NewBlogPost[]>(`/admin/blog/new-posts?sinceMinutes=${sinceMinutes}`),
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ synced: number; newPosts: number }>('/admin/blog/sync', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`RSS 싱크 완료 — ${result.synced}개 피드, 새 글 ${result.newPosts}개`);
      void queryClient.invalidateQueries({ queryKey: ['blog-new-posts'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '싱크 실패', 'error'),
  });

  const backfillMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ updated: number }>('/admin/blog/backfill', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`백필 완료 — ${result.updated}명 업데이트`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '백필 실패', 'error'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
        >
          {syncMutation.isPending ? 'RSS 싱크 중...' : 'RSS 전체 싱크'}
        </button>
        <button
          onClick={() => backfillMutation.mutate()}
          disabled={backfillMutation.isPending}
          className="bg-gray-700 text-white text-sm rounded px-4 py-1.5 hover:bg-gray-800 disabled:opacity-40"
        >
          {backfillMutation.isPending ? '백필 중...' : 'GitHub 블로그 백필'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-500">최근</label>
          <select
            value={sinceMinutes}
            onChange={(e) => setSinceMinutes(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={65}>65분</option>
            <option value={360}>6시간</option>
            <option value={1440}>24시간</option>
            <option value={10080}>7일</option>
          </select>
          <span className="text-xs text-gray-400">새 글</span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
      ) : (
        <>
          <p className="text-xs text-gray-500">{posts.length}개 포스트</p>
          <div className="space-y-2">
            {posts.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">새 포스트 없음</div>
            ) : (
              posts.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded p-3">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline block truncate"
                  >
                    {p.title}
                  </a>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.member.nickname ?? p.member.githubId} ·{' '}
                    {new Date(p.publishedAt).toLocaleString('ko-KR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
