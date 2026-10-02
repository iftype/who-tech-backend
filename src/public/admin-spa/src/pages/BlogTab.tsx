import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { NewBlogPost, TeamBlogStatus } from '../lib/types.js';

export default function BlogTab() {
  const [sinceMinutes, setSinceMinutes] = useState(65);
  const queryClient = useQueryClient();

  const { data: teamBlogs = [] } = useQuery({
    queryKey: ['team-blog-status'],
    queryFn: () => apiFetch<TeamBlogStatus[]>('/admin/blog/team'),
  });
  const teamBlog = teamBlogs[0];
  const [teamForm, setTeamForm] = useState({ name: '', blogUrl: '', rssUrl: '' });

  useEffect(() => {
    if (!teamBlog) return;
    setTeamForm({ name: teamBlog.name, blogUrl: teamBlog.blogUrl, rssUrl: teamBlog.rssUrl });
  }, [teamBlog]);

  const updateTeamBlogMutation = useMutation({
    mutationFn: () => apiFetch(`/admin/blog/team/${teamBlog?.id}`, { method: 'PATCH', body: JSON.stringify(teamForm) }),
    onSuccess: () => {
      showToast('팀 블로그 설정을 저장했습니다.');
      void queryClient.invalidateQueries({ queryKey: ['team-blog-status'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '팀 블로그 설정 저장 실패', 'error'),
  });

  const teamSyncMutation = useMutation({
    mutationFn: () => apiFetch<{ synced: number; deleted: number; failures: unknown[] }>('/admin/blog/team/sync', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`팀 블로그 새로고침 완료 — ${result.synced}건 수집`);
      void queryClient.invalidateQueries({ queryKey: ['team-blog-status'] });
      void queryClient.invalidateQueries({ queryKey: ['blog-new-posts'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '팀 블로그 새로고침 실패', 'error'),
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-new-posts', sinceMinutes],
    queryFn: () => apiFetch<NewBlogPost[]>(`/admin/blog/new-posts?sinceMinutes=${sinceMinutes}`),
  });

  const syncMutation = useMutation({
    mutationFn: () => apiFetch<{ id: string; status: string }>('/admin/blog/sync', { method: 'POST' }),
    onSuccess: () => {
      showToast('RSS 싱크 작업이 큐에 추가되었습니다. 진행 상황은 싱크 탭에서 확인할 수 있습니다.');
      void queryClient.invalidateQueries({ queryKey: ['blog-new-posts'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '싱크 실패', 'error'),
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiFetch<{ updated: number }>('/admin/blog/backfill', { method: 'POST' }),
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
          onClick={() => teamSyncMutation.mutate()}
          disabled={teamSyncMutation.isPending}
          className="bg-emerald-600 text-white text-sm rounded px-4 py-1.5 hover:bg-emerald-700 disabled:opacity-40"
        >
          {teamSyncMutation.isPending ? '팀 블로그 수집 중...' : '팀 블로그 새로고침'}
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

      <section className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-start gap-3">
          <img
            src={teamBlog?.avatarUrl ?? '/rilog-avatar.png'}
            alt="Rilog"
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">{teamBlog?.name ?? 'Rilog'} 팀 블로그</h2>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${teamBlog?.rssStatus === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {teamBlog?.rssStatus === 'available'
                  ? 'RSS 연결됨'
                  : teamBlog?.rssStatus === 'not_synced'
                    ? '아직 싱크 전'
                    : (teamBlog?.rssStatus ?? '확인 중')}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500 break-all">RSS: {teamBlog?.rssUrl ?? '로딩 중...'}</div>
            {teamBlog && (
              <div className="mt-1 text-xs text-gray-400">
                최근 수집 글 {teamBlog.posts.length}개 · 최근 발행{' '}
                {teamBlog.lastPostedAt ? new Date(teamBlog.lastPostedAt).toLocaleString('ko-KR') : '없음'}
              </div>
            )}
          </div>
          <a
            href={teamBlog?.blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline shrink-0"
          >
            블로그 열기
          </a>
        </div>
      </section>

      {teamBlog && (
        <section className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="mb-3 text-xs font-semibold text-gray-600">팀 블로그 설정</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={teamForm.name}
              onChange={(e) => setTeamForm((v) => ({ ...v, name: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              placeholder="팀 이름"
            />
            <input
              value={teamForm.blogUrl}
              onChange={(e) => setTeamForm((v) => ({ ...v, blogUrl: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              placeholder="블로그 URL"
            />
            <input
              value={teamForm.rssUrl}
              onChange={(e) => setTeamForm((v) => ({ ...v, rssUrl: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              placeholder="RSS URL"
            />
          </div>
          <button
            onClick={() => updateTeamBlogMutation.mutate()}
            disabled={updateTeamBlogMutation.isPending}
            className="mt-3 rounded bg-gray-800 px-3 py-1.5 text-xs text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {updateTeamBlogMutation.isPending ? '저장 중...' : '설정 저장'}
          </button>
        </section>
      )}

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
                    {p.member.nickname ?? p.member.githubId} · {new Date(p.publishedAt).toLocaleString('ko-KR')}
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
