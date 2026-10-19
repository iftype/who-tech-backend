import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createEventSource } from '../lib/sse.js';

import { showToast } from '../components/ui/Toast.js';
import type { SyncQueueJob } from '../lib/types.js';
import { formatDate, type JobType } from './sync/sync-format.js';
import type { RecentSyncJob } from '../lib/types.js';
import { formatStep, logColor, type StreamLogEntry } from '../lib/stream-log.js';
import { SyncScheduleStatus } from './sync/SyncScheduleStatus.js';
import { RecentJobsTable } from './sync/RecentJobsTable.js';
import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Table, TBody, THead, Td, Th } from '../components/ui/Table.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { FieldLabel, TextInput } from '../components/ui/Field.js';
import { Panel, SectionTitle } from '../components/ui/Section.js';

export default function SyncTab() {
  const [cohortInput, setCohortInput] = useState('');
  const [running, setRunning] = useState<JobType | null>(null);
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [remainingTime, setRemainingTime] = useState('');

  const getNextSyncTime = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next;
  };

  const formatRemainingTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}분 ${seconds}초`;
  };

  useEffect(() => {
    const updateRemaining = () => {
      const now = new Date();
      const next = getNextSyncTime();
      const diff = next.getTime() - now.getTime();
      setRemainingTime(formatRemainingTime(diff));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, []);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: queryKeys.adminStatus(),
    queryFn: () => adminApi.status(),
    staleTime: 60_000,
  });

  const { data: workspace } = useQuery({
    queryKey: queryKeys.workspace(),
    queryFn: () => adminApi.workspace.get(),
    staleTime: 300_000,
  });

  const { data: githubStatus } = useQuery({
    queryKey: queryKeys.githubStatus(),
    queryFn: () => adminApi.githubStatus(),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const { data: repos = [] } = useQuery({
    queryKey: queryKeys.repos.syncSchedule(),
    queryFn: () => adminApi.repos.list(),
  });

  const { data: tecoTalks = [] } = useQuery({
    queryKey: queryKeys.tecotalkSyncStatus(),
    queryFn: () => adminApi.tecotalk.list(),
    staleTime: 30_000,
  });

  const continuousRepos = repos.filter((r) => r.status === 'active' && r.syncMode === 'continuous');
  const repoCount = status?.activeRepoCount ?? status?.repoCount;
  const tecoTalkStatusCounts = tecoTalks.reduce(
    (acc, talk) => {
      acc[talk.matchStatus] += 1;
      return acc;
    },
    { matched: 0, ambiguous: 0, unmatched: 0 },
  );
  const latestTecoTalk = tecoTalks[0];

  const { data: repoJobs = [] } = useQuery({
    queryKey: queryKeys.repos.syncJobs(),
    queryFn: () => adminApi.repos.syncJobs(),
    staleTime: 10_000,
    refetchInterval: running ? 2000 : 10_000,
  });

  const { data: blogJobs = [] } = useQuery({
    queryKey: queryKeys.blog.syncJobs(),
    queryFn: () => adminApi.blog.syncJobs(),
    staleTime: 10_000,
    refetchInterval: running ? 2000 : 10_000,
  });

  const { data: queueJobs = [] } = useQuery({
    queryKey: queryKeys.syncQueueJobs(),
    queryFn: () => adminApi.sync.jobs(),
    staleTime: 0,
    refetchInterval: 3000,
  });

  const activeQueueJobs = queueJobs.filter((j) => j.status === 'queued' || j.status === 'running');
  const recentQueueJobs = queueJobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled',
  );

  const allJobs = [...recentQueueJobs, ...repoJobs, ...blogJobs].sort((a, b) => {
    const aDate = new Date((a as SyncQueueJob).completedAt ?? (a as RecentSyncJob).startedAt ?? 0);
    const bDate = new Date((b as SyncQueueJob).completedAt ?? (b as RecentSyncJob).startedAt ?? 0);
    return bDate.getTime() - aDate.getTime();
  });

  const queryClient = useQueryClient();

  const blogSyncMutation = useMutation({
    mutationFn: () => adminApi.blog.sync(),
    onSuccess: () => {
      showToast('블로그 싱크 작업이 큐에 추가되었습니다');
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.syncJobs() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '블로그 싱크 실패', 'error'),
  });

  const profileRefreshMutation = useMutation({
    mutationFn: () => adminApi.members.refreshProfiles(),
    onSuccess: (result) => {
      showToast(`프로필 새로고침 완료 — ${result.refreshed}/${result.checked}명, 실패 ${result.failed}명`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '프로필 새로고침 실패', 'error'),
  });

  const tecoTalkSyncMutation = useMutation({
    mutationFn: (mode: 'incremental' | 'full') => adminApi.tecotalk.sync(mode),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tecotalkSyncStatus() });
      showToast(
        `테코톡 싱크 완료 — ${result.matched}/${result.total} 매칭, ambiguous ${result.ambiguous}, unmatched ${result.unmatched}`,
      );
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '테코톡 싱크 실패', 'error'),
  });

  const toggleBlogSyncMutation = useMutation({
    mutationFn: (enabled: boolean) => adminApi.workspace.update({ blogSyncEnabled: enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '변경 실패', 'error'),
  });

  const toggleProfileRefreshMutation = useMutation({
    mutationFn: (enabled: boolean) => adminApi.workspace.update({ profileRefreshEnabled: enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '변경 실패', 'error'),
  });

  const enqueueMutation = useMutation({
    mutationFn: (params: { type: 'workspace' | 'continuous' | 'cohort-repos'; cohort?: number }) =>
      adminApi.sync.createJob(params),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });
      showToast('작업이 큐에 추가되었습니다');
      setLogs([]);
      setRunning(result.id as unknown as JobType);
      addLog('info', `작업 ${result.id} 시작 대기 중`);
      const es = createEventSource(`/admin/sync/jobs/${result.id}/stream`);
      esRef.current = es;
      es.addEventListener('progress', (e: MessageEvent) => {
        try {
          addLog('progress', formatStep(JSON.parse(e.data as string)));
        } catch {
          addLog('progress', e.data as string);
        }
      });
      es.addEventListener('done', (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data as string) as Record<string, unknown>;
          const msg = d['message'] ? String(d['message']) : '완료';
          addLog('done', msg);
        } catch {
          addLog('done', '완료');
        }
        stop();
        void refetchStatus();
        void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });
      });
      es.addEventListener('error', (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data as string) as Record<string, unknown>;
          addLog('error', d['message'] ? String(d['message']) : '오류 발생');
        } catch {
          addLog('error', '연결 오류');
        }
        stop();
        void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });
      });
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          stop();
          void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });
        }
      };
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '큐 추가 실패', 'error'),
  });

  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) => adminApi.sync.cancelJob(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });
      showToast('작업이 취소되었습니다');
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '취소 실패', 'error'),
  });

  const addLog = useCallback((type: StreamLogEntry['type'], message: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), type, message }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(null);
  }, []);

  const runSync = () => {
    enqueueMutation.mutate({
      type: 'workspace',
      ...(cohortInput ? { cohort: Number(cohortInput) } : {}),
    });
  };

  const runContinuous = () => enqueueMutation.mutate({ type: 'continuous' });

  const runCohortRepos = () => {
    if (!cohortInput) return;
    enqueueMutation.mutate({ type: 'cohort-repos', cohort: Number(cohortInput) });
  };

  return (
    <div className="space-y-4">
      {/* 상태 */}
      {status && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Panel>
            <p className="text-xs text-base-500">멤버 수</p>
            <p className="text-xl font-semibold text-base-900">{status.memberCount}</p>
          </Panel>
          <Panel>
            <p className="text-xs text-base-500">활성 레포</p>
            <p className="text-xl font-semibold text-base-900">{repoCount ?? '—'}</p>
          </Panel>
          <Panel>
            <p className="text-xs text-base-500">마지막 싱크</p>
            <p className="text-sm font-medium text-base-700">{formatDate(status.lastSyncAt)}</p>
          </Panel>
          <Panel>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-base-500">GitHub API</p>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  !githubStatus
                    ? 'bg-base-100 text-base-500'
                    : githubStatus.ok
                      ? githubStatus.remaining < 100
                        ? 'bg-caution-100 text-caution-700'
                        : 'bg-success-100 text-success-700'
                      : 'bg-danger-100 text-danger-700'
                }`}
              >
                {!githubStatus ? '확인 중' : githubStatus.ok ? '정상' : '오류'}
              </span>
            </div>
            <p className="text-xl font-semibold text-base-900">
              {githubStatus?.ok ? `${githubStatus.remaining}/${githubStatus.limit}` : '—'}
            </p>
            {githubStatus?.resetAt && (
              <p className="text-[10px] text-base-400">reset {formatDate(githubStatus.resetAt)}</p>
            )}
          </Panel>
          <Panel>
            <p className="text-xs text-base-500">테코톡 매칭</p>
            <p className="text-xl font-semibold text-base-900">
              {tecoTalkStatusCounts.matched}/{tecoTalks.length}
            </p>
            <p className="text-[10px] text-base-400">
              ambiguous {tecoTalkStatusCounts.ambiguous} · unmatched {tecoTalkStatusCounts.unmatched}
            </p>
          </Panel>
        </div>
      )}

      <SyncScheduleStatus
        workspace={workspace}
        status={status}
        remainingTime={remainingTime}
        continuousRepos={continuousRepos}
      />

      {/* 블로그 싱크 */}
      <Panel variant="card">
        <SectionTitle as="h3" size="sm" className="mb-2">
          블로그
        </SectionTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => blogSyncMutation.mutate()} disabled={blogSyncMutation.isPending}>
            {blogSyncMutation.isPending ? 'RSS 싱크 중...' : 'RSS 전체 싱크'}
          </Button>
          <label className="flex items-center gap-2 bg-base-50 border border-base-200 rounded px-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={workspace?.blogSyncEnabled ?? false}
              onChange={(e) => toggleBlogSyncMutation.mutate(e.target.checked)}
              disabled={toggleBlogSyncMutation.isPending}
              className="rounded"
            />
            <span className="text-xs text-base-700">자동 싱크</span>
          </label>
        </div>
      </Panel>

      {/* 프로필 새로고침 */}
      <Panel variant="card">
        <SectionTitle as="h3" size="sm" className="mb-2">
          프로필
        </SectionTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => profileRefreshMutation.mutate()}
            disabled={profileRefreshMutation.isPending}
            tone="success"
          >
            {profileRefreshMutation.isPending ? '프로필 새로고침 중...' : '프로필 전체 새로고침'}
          </Button>
          <label className="flex items-center gap-2 bg-base-50 border border-base-200 rounded px-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={workspace?.profileRefreshEnabled ?? false}
              onChange={(e) => toggleProfileRefreshMutation.mutate(e.target.checked)}
              disabled={toggleProfileRefreshMutation.isPending}
              className="rounded"
            />
            <span className="text-xs text-base-700">자동 새로고침</span>
          </label>
        </div>
      </Panel>

      {/* 테코톡 */}
      <Panel variant="card" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionTitle as="h3" size="sm">
              테코톡
            </SectionTitle>
            <p className="text-[11px] text-base-400 mt-1">
              최신 업로드:{' '}
              {latestTecoTalk ? `${latestTecoTalk.title} · ${formatDate(latestTecoTalk.uploadedAt)}` : '없음'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => tecoTalkSyncMutation.mutate('incremental')}
              disabled={tecoTalkSyncMutation.isPending}
              tone="danger"
            >
              {tecoTalkSyncMutation.isPending ? '싱크 중...' : '증분 싱크'}
            </Button>
            <Button
              onClick={() => tecoTalkSyncMutation.mutate('full')}
              disabled={tecoTalkSyncMutation.isPending}
              tone="neutral"
            >
              {tecoTalkSyncMutation.isPending ? '싱크 중...' : '전체 재매칭'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="rounded border border-base-200 bg-base-50 p-2">
            <p className="text-base-500">전체</p>
            <p className="font-semibold text-base-900">{tecoTalks.length}</p>
          </div>
          <div className="rounded border border-success-200 bg-success-50 p-2">
            <p className="text-success-700">matched</p>
            <p className="font-semibold text-success-900">{tecoTalkStatusCounts.matched}</p>
          </div>
          <div className="rounded border border-caution-200 bg-caution-50 p-2">
            <p className="text-caution-700">ambiguous</p>
            <p className="font-semibold text-caution-900">{tecoTalkStatusCounts.ambiguous}</p>
          </div>
          <div className="rounded border border-danger-200 bg-danger-50 p-2">
            <p className="text-danger-700">unmatched</p>
            <p className="font-semibold text-danger-900">{tecoTalkStatusCounts.unmatched}</p>
          </div>
        </div>
      </Panel>

      {/* 컨트롤 */}
      <Panel variant="card" className="space-y-3">
        <SectionTitle as="h3" size="sm">
          미션 싱크
        </SectionTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <FieldLabel>기수 (선택)</FieldLabel>
            <TextInput
              type="number"
              value={cohortInput}
              onChange={(e) => setCohortInput(e.target.value)}
              placeholder="예: 9"
              size="sm"
              className="w-20"
              disabled={!!running}
            />
          </div>
          <div className="flex gap-2 items-end flex-wrap pt-4">
            <Button onClick={runSync} disabled={enqueueMutation.isPending}>
              {enqueueMutation.isPending ? '큐 추가 중...' : cohortInput ? `${cohortInput}기 싱크` : '전체 싱크'}
            </Button>
            <Button onClick={runContinuous} disabled={enqueueMutation.isPending} tone="accent">
              {enqueueMutation.isPending ? '큐 추가 중...' : '연속 싱크'}
            </Button>
            <Button
              onClick={runCohortRepos}
              disabled={enqueueMutation.isPending || !cohortInput}
              tone="neutral"
              title={!cohortInput ? '기수를 입력하세요' : undefined}
            >
              {enqueueMutation.isPending ? '큐 추가 중...' : '기수 레포 업데이트'}
            </Button>
            {running && (
              <Button onClick={stop} tone="dangerSoft">
                중단
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {activeQueueJobs.length > 0 && (
        <Panel variant="card">
          <SectionTitle as="h3" size="sm" className="mb-3">
            현재 싱크 작업 ({activeQueueJobs.length})
          </SectionTitle>
          <div className="max-h-64 overflow-y-auto rounded border border-base-200">
            <Table size="xs">
              <THead>
                <tr>
                  <Th size="inherit">시작</Th>
                  <Th size="inherit">종류</Th>
                  <Th size="inherit">상태</Th>
                  <Th size="inherit">진행</Th>
                  <Th size="inherit">결과</Th>
                  <Th size="inherit">액션</Th>
                </tr>
              </THead>
              <TBody>
                {activeQueueJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-base-50">
                    <Td className="text-base-500 whitespace-nowrap">
                      {new Date(j.status === 'running' && j.startedAt ? j.startedAt : j.createdAt).toLocaleString(
                        'ko-KR',
                      )}
                    </Td>
                    <Td>
                      <Badge emphasis="subtle" tone="primary">
                        {j.type === 'workspace' ? '전체' : j.type === 'continuous' ? '연속' : '기수레포'}
                        {j.cohort != null ? ` (${j.cohort}기)` : ''}
                      </Badge>
                    </Td>
                    <Td>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          j.status === 'queued' ? 'bg-base-100 text-base-600' : 'bg-primary-100 text-primary-700'
                        }`}
                      >
                        {j.status}
                      </span>
                    </Td>
                    <Td className="text-base-700">
                      {j.progress ? `${j.progress.repo} (${j.progress.done}/${j.progress.total})` : '—'}
                    </Td>
                    <Td className="text-base-700 truncate max-w-[200px]">—</Td>
                    <Td>
                      <button
                        onClick={() => cancelJobMutation.mutate(j.id)}
                        disabled={cancelJobMutation.isPending}
                        className="text-xs px-2 py-0.5 rounded bg-danger-50 text-danger-600 hover:bg-danger-100 disabled:opacity-40"
                      >
                        취소
                      </button>
                    </Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Panel>
      )}

      {/* 로그 */}
      {logs.length > 0 && (
        <div className="bg-base-900 rounded border border-base-700 p-4 font-mono text-xs max-h-96 overflow-y-auto">
          {logs.map((entry, i) => (
            <div key={i} className={`${logColor(entry.type)} leading-5`}>
              <span className="text-base-600 mr-2">{new Date(entry.ts).toLocaleTimeString('ko-KR')}</span>
              {entry.message}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {allJobs.length > 0 && <RecentJobsTable jobs={allJobs} />}
    </div>
  );
}
