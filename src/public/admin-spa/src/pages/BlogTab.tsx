import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../components/ui/Toast.js';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState, panelVariants, SectionTitle } from '../components/ui/Section.js';
import { Select, TextInput } from '../components/ui/Field.js';
import { TextLink } from '../components/ui/TextLink.js';

export default function BlogTab() {
  const [sinceMinutes, setSinceMinutes] = useState(65);
  const queryClient = useQueryClient();

  const { data: teamBlogs = [] } = useQuery({
    queryKey: queryKeys.blog.teamStatus(),
    queryFn: () => adminApi.blog.teamStatus(),
  });
  const teamBlog = teamBlogs[0];
  const [teamForm, setTeamForm] = useState({ name: '', blogUrl: '', rssUrl: '' });

  useEffect(() => {
    if (!teamBlog) return;
    setTeamForm({ name: teamBlog.name, blogUrl: teamBlog.blogUrl, rssUrl: teamBlog.rssUrl });
  }, [teamBlog]);

  const updateTeamBlogMutation = useMutation({
    mutationFn: () => adminApi.blog.updateTeam(teamBlog?.id, teamForm),
    onSuccess: () => {
      showToast('팀 블로그 설정을 저장했습니다.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.teamStatus() });
    },
    meta: { errorMessage: '팀 블로그 설정 저장 실패' },
  });

  const teamSyncMutation = useMutation({
    mutationFn: () => adminApi.blog.syncTeam(),
    onSuccess: (result) => {
      showToast(`팀 블로그 새로고침 완료 — ${result.synced}건 수집`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.teamStatus() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.newPostsAll() });
    },
    meta: { errorMessage: '팀 블로그 새로고침 실패' },
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: queryKeys.blog.newPosts(sinceMinutes),
    queryFn: () => adminApi.blog.newPosts(sinceMinutes),
  });

  const syncMutation = useMutation({
    mutationFn: () => adminApi.blog.sync(),
    onSuccess: () => {
      showToast('RSS 싱크 작업이 큐에 추가되었습니다. 진행 상황은 싱크 탭에서 확인할 수 있습니다.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.newPostsAll() });
    },
    meta: { errorMessage: '싱크 실패' },
  });

  const backfillMutation = useMutation({
    mutationFn: () => adminApi.blog.backfill(),
    onSuccess: (result) => {
      showToast(`백필 완료 — ${result.updated}명 업데이트`);
    },
    meta: { errorMessage: '백필 실패' },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? 'RSS 싱크 중...' : 'RSS 전체 싱크'}
        </Button>
        <Button onClick={() => teamSyncMutation.mutate()} disabled={teamSyncMutation.isPending} tone="positive">
          {teamSyncMutation.isPending ? '팀 블로그 수집 중...' : '팀 블로그 새로고침'}
        </Button>
        <Button onClick={() => backfillMutation.mutate()} disabled={backfillMutation.isPending} tone="neutral">
          {backfillMutation.isPending ? '백필 중...' : 'GitHub 블로그 백필'}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-base-500">최근</label>
          <Select value={sinceMinutes} onChange={(e) => setSinceMinutes(Number(e.target.value))} size="xs">
            <option value={65}>65분</option>
            <option value={360}>6시간</option>
            <option value={1440}>24시간</option>
            <option value={10080}>7일</option>
          </Select>
          <span className="text-xs text-base-400">새 글</span>
        </div>
      </div>

      <section className={panelVariants({ variant: 'cardLg' })}>
        <div className="flex items-start gap-3">
          <img
            src={teamBlog?.avatarUrl ?? '/rilog-avatar.png'}
            alt="Rilog"
            className="h-10 w-10 rounded-full object-cover border border-base-200"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">{teamBlog?.name ?? 'Rilog'} 팀 블로그</h2>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${teamBlog?.rssStatus === 'available' ? 'bg-success-100 text-success-700' : 'bg-base-100 text-base-500'}`}
              >
                {teamBlog?.rssStatus === 'available'
                  ? 'RSS 연결됨'
                  : teamBlog?.rssStatus === 'not_synced'
                    ? '아직 싱크 전'
                    : (teamBlog?.rssStatus ?? '확인 중')}
              </span>
            </div>
            <div className="mt-1 text-xs text-base-500 break-all">RSS: {teamBlog?.rssUrl ?? '로딩 중...'}</div>
            {teamBlog && (
              <div className="mt-1 text-xs text-base-400">
                최근 수집 글 {teamBlog.posts.length}개 · 최근 발행{' '}
                {teamBlog.lastPostedAt ? new Date(teamBlog.lastPostedAt).toLocaleString('ko-KR') : '없음'}
              </div>
            )}
          </div>
          <TextLink href={teamBlog?.blogUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
            블로그 열기
          </TextLink>
        </div>
      </section>

      {teamBlog && (
        <section className={panelVariants({ variant: 'cardLg' })}>
          <SectionTitle as="h3" size="sm" className="mb-3">
            팀 블로그 설정
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-3">
            <TextInput
              value={teamForm.name}
              onChange={(e) => setTeamForm((v) => ({ ...v, name: e.target.value }))}
              size="sm"
              placeholder="팀 이름"
            />
            <TextInput
              value={teamForm.blogUrl}
              onChange={(e) => setTeamForm((v) => ({ ...v, blogUrl: e.target.value }))}
              size="sm"
              placeholder="블로그 URL"
            />
            <TextInput
              value={teamForm.rssUrl}
              onChange={(e) => setTeamForm((v) => ({ ...v, rssUrl: e.target.value }))}
              size="sm"
              placeholder="RSS URL"
            />
          </div>
          <button
            onClick={() => updateTeamBlogMutation.mutate()}
            disabled={updateTeamBlogMutation.isPending}
            className="mt-3 rounded bg-base-800 px-3 py-1.5 text-xs text-white hover:bg-base-700 disabled:opacity-40"
          >
            {updateTeamBlogMutation.isPending ? '저장 중...' : '설정 저장'}
          </button>
        </section>
      )}

      {isLoading ? (
        <EmptyState>로딩 중...</EmptyState>
      ) : (
        <>
          <p className="text-xs text-base-500">{posts.length}개 포스트</p>
          <div className="space-y-2">
            {posts.length === 0 ? (
              <EmptyState>새 포스트 없음</EmptyState>
            ) : (
              posts.map((p) => (
                <div key={p.id} className="border border-base-200 rounded p-3">
                  <TextLink href={p.url} target="_blank" rel="noopener noreferrer" size="sm" className="block truncate">
                    {p.title}
                  </TextLink>
                  <p className="text-xs text-base-500 mt-0.5">
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
