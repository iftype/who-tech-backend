import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { addLog } from '../../components/LogPanel.js';
import { pollSyncJob } from '../../lib/api.js';
import type { MissionRepo, SyncJob } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { toErrorMessage } from '../../lib/query-client.js';
import { confirmAction } from '../../components/ui/ConfirmDialog.js';

const without = <T>(set: Set<T>, value: T) => {
  const next = new Set(set);
  next.delete(value);
  return next;
};

const withoutKey = <K, V>(map: Map<K, V>, key: K) => {
  const next = new Map(map);
  next.delete(key);
  return next;
};

// 레포별 싱크를 요청하고 끝날 때까지 진행 상황을 폴링한다. 화면을 떠나면 폴링을 모두 멈춘다
export function useRepoSync() {
  const queryClient = useQueryClient();
  const [syncingRepos, setSyncingRepos] = useState<Set<number>>(new Set());
  const [activeJobs, setActiveJobs] = useState<Map<number, SyncJob>>(new Map());
  const stopPollFns = useRef<Map<number, () => void>>(new Map());

  useEffect(() => () => stopPollFns.current.forEach((stop) => stop()), []);

  const finish = (repoId: number) => {
    setSyncingRepos((prev) => without(prev, repoId));
    setActiveJobs((prev) => withoutKey(prev, repoId));
    stopPollFns.current.delete(repoId);
  };

  const syncRepo = async (repo: MissionRepo) => {
    setSyncingRepos((prev) => new Set(prev).add(repo.id));
    addLog('run', `[${repo.name}] 싱크 시작`);
    try {
      const job = await adminApi.repos.sync(repo.id);
      setActiveJobs((prev) => new Map(prev).set(repo.id, job));

      const stop = pollSyncJob(job.id, (updated) => {
        setActiveJobs((prev) => new Map(prev).set(repo.id, updated));
        if (updated.progress) {
          addLog('run', `[${repo.name}] ${updated.progress.percent}% — ${updated.progress.phase}`);
        }
        if (updated.status === 'completed') {
          addLog('ok', `[${repo.name}] 싱크 완료 (${updated.result?.synced ?? 0}건)`);
          showToast(`${repo.name} 싱크 완료`);
          finish(repo.id);
          void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
        } else if (updated.status === 'failed') {
          addLog('err', `[${repo.name}] 싱크 실패: ${updated.error ?? updated.message}`);
          showToast(`${repo.name} 싱크 실패`, 'error');
          finish(repo.id);
        } else if (updated.status === 'cancelled') {
          addLog('err', `[${repo.name}] 싱크 취소됨`);
          finish(repo.id);
        }
      });
      stopPollFns.current.set(repo.id, stop);
    } catch (e) {
      addLog('err', `[${repo.name}] 싱크 요청 실패`);
      showToast(toErrorMessage(e, '싱크 실패'), 'error');
      setSyncingRepos((prev) => without(prev, repo.id));
    }
  };

  // base 카테고리의 active 레포를 하나씩 차례로 싱크 요청한다
  const syncAllBase = async (repos: MissionRepo[]) => {
    const targets = repos.filter((r) => r.tabCategory === 'base' && r.status === 'active');
    if (targets.length === 0) {
      showToast('대상 레포가 없습니다', 'error');
      return;
    }
    if (
      !(await confirmAction(
        `base 카테고리의 active 레포 ${targets.length}개를 순차적으로 싱크합니다. 계속하시겠습니까?`,
      ))
    )
      return;
    addLog('info', `[Batch] base 전체 싱크 시작 — ${targets.length}개`);
    for (const repo of targets) {
      await syncRepo(repo);
    }
    addLog('ok', `[Batch] base 전체 싱크 완료 — ${targets.length}개`);
    showToast('base 전체 싱크 완료');
  };

  return { syncingRepos, activeJobs, isBusy: syncingRepos.size > 0, syncRepo, syncAllBase };
}

export type RepoSync = ReturnType<typeof useRepoSync>;
