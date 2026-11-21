import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../components/ui/Toast.js';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState, ErrorState } from '../components/ui/Section.js';
import { Select } from '../components/ui/Field.js';
import { TextLink } from '../components/ui/TextLink.js';

export default function BlogTab() {
  const [sinceMinutes, setSinceMinutes] = useState(65);
  const queryClient = useQueryClient();

  const {
    data: posts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
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

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
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
