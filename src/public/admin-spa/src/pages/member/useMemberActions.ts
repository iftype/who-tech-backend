import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { useRefreshCooldowns } from '../../hooks/useRefreshCooldowns.js';
import type { Member } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';

// 멤버 목록 캐시만 고른다: ['members', filters]. ['members', 'prs'] 같은 다른 모양은 건드리지 않는다
const memberListFilter = {
  queryKey: queryKeys.members.all(),
  predicate: (query: { queryKey: readonly unknown[] }) =>
    typeof query.queryKey[1] === 'object' && query.queryKey[1] !== null,
};

// 멤버 한 명에 대한 작업(프로필 새로고침·PR 재수집·기수 재계산·삭제)과 진행 상태
export function useMemberActions(onRefresh: () => void) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [recalculating, setRecalculating] = useState<number | null>(null);
  const [resyncing, setResyncing] = useState<number | null>(null);
  const { cooldowns, startCooldown } = useRefreshCooldowns();

  const refreshProfile = async (member: Member) => {
    const remaining = cooldowns[member.id];
    if (remaining && remaining > 0) {
      showToast(`${remaining}초 후에 다시 시도해주세요`, 'error');
      return;
    }
    setRefreshing(member.id);
    try {
      await adminApi.members.refreshProfile(member.id);
      startCooldown(member.id);
      showToast(`${member.githubId} 새로고침 완료`);
      onRefresh();
    } catch (e) {
      const err = e as Error & { remainingSeconds?: number };
      if (err.remainingSeconds && err.remainingSeconds > 0) {
        startCooldown(member.id, err.remainingSeconds);
        showToast(`${err.remainingSeconds}초 후에 다시 시도해주세요`, 'error');
      } else {
        showToast(err.message || '새로고침 실패', 'error');
      }
    } finally {
      setRefreshing(null);
    }
  };

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: number) => adminApi.members.remove(memberId),
    // 목록은 필터마다 ['members', filters] 로 캐시된다. setQueryData는 키가 정확히 같아야 해서
    // ['members'] 에 쓰면 화면 목록이 안 바뀐다 → 앞부분이 같은 목록 캐시 전부를 setQueriesData로 고친다
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.members.all() });
      const previous = queryClient.getQueriesData<Member[]>(memberListFilter);
      queryClient.setQueriesData<Member[]>(memberListFilter, (old) => old?.filter((m) => m.id !== memberId));
      return { previous };
    },
    onError: (_err, _memberId, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      showToast('삭제 실패', 'error');
    },
    // 재요청은 onSettled의 invalidate 한 번으로 충분하다 (onRefresh까지 부르면 같은 목록을 두 번 받는다)
    onSuccess: () => {
      showToast('삭제 완료');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() });
    },
  });

  const deleteMember = (member: Member) => {
    if (!confirm(`${member.githubId} 삭제하시겠습니까?`)) return;
    deleteMemberMutation.mutate(member.id);
  };

  const recalculateCohorts = async (member: Member) => {
    if (!confirm(`${member.githubId}의 기수를 submissions 기준으로 재계산합니다. 계속하시겠습니까?`)) return;
    setRecalculating(member.id);
    try {
      await adminApi.members.recalculateCohorts(member.id);
      showToast('기수 재계산 완료');
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '기수 재계산 실패', 'error');
    } finally {
      setRecalculating(null);
    }
  };

  const resyncSubmissions = async (member: Member) => {
    if (!confirm(`${member.githubId}의 PR을 모든 레포지토리에서 재수집합니다. 계속하시겠습니까?`)) return;
    setResyncing(member.id);
    try {
      const result = await adminApi.members.resyncSubmissions(member.id);
      showToast(`${member.githubId} PR 재수집 완료 (${result.totalSynced}개)`);
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'PR 재수집 실패', 'error');
    } finally {
      setResyncing(null);
    }
  };

  return {
    cooldowns,
    refreshing,
    recalculating,
    resyncing,
    refreshProfile,
    deleteMember,
    recalculateCohorts,
    resyncSubmissions,
  };
}

export type MemberActions = ReturnType<typeof useMemberActions>;
