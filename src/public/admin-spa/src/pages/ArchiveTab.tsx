import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../components/ui/Toast.js';
import { StreamLogConsole } from '../components/StreamLogConsole.js';
import { useEventStreamLog } from '../hooks/useEventStreamLog.js';
import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState, Panel, SectionTitle } from '../components/ui/Section.js';
import { FieldLabel, Select, TextInput } from '../components/ui/Field.js';
import { CohortRepoAddBar } from './archive/CohortRepoAddBar.js';
import { CohortRepoTable } from './archive/CohortRepoTable.js';
import { groupCohortReposByLevel } from './archive/group-by-level.js';
import { useCohortRepoEditor } from './archive/useCohortRepoEditor.js';

export default function ArchiveTab() {
  const queryClient = useQueryClient();
  const [cohort, setCohort] = useState('');
  const [track, setTrack] = useState('');
  const stream = useEventStreamLog();
  const editor = useCohortRepoEditor();

  const cohortNum = cohort ? Number(cohort) : NaN;
  const hasCohort = Number.isFinite(cohortNum) && cohortNum > 0;

  const { data: cohortRepos = [], isLoading: reposLoading } = useQuery({
    queryKey: queryKeys.cohortRepos.byCohort(cohortNum),
    queryFn: () => adminApi.cohortRepos.list(cohortNum),
    enabled: hasCohort,
  });

  const { data: allRepos = [] } = useQuery({
    queryKey: queryKeys.repos.all(),
    queryFn: () => adminApi.repos.list(),
  });

  const filteredRepos = track ? cohortRepos.filter((cr) => cr.missionRepo.track === track) : cohortRepos;
  const commonRepos = filteredRepos.filter((cr) => cr.missionRepo.tabCategory === 'common');
  const trackRepos = filteredRepos.filter((cr) => cr.missionRepo.tabCategory !== 'common');

  const autoFillMutation = useMutation({
    mutationFn: () => adminApi.cohortRepos.autoFill(cohortNum),
    onSuccess: (result) => {
      showToast(`${result.added}개 레포 자동 추가 완료`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.cohortRepos.all() });
    },
    meta: { errorMessage: '자동 채우기 실패' },
  });

  const runCohortReposSync = () => {
    if (stream.running || !Number.isFinite(cohortNum)) return;
    stream.follow(`/admin/sync/cohort-repos/stream?cohort=${cohortNum}`, '기수 레포 업데이트 시작');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <FieldLabel>기수 (필수)</FieldLabel>
          <TextInput
            type="number"
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
            placeholder="예: 8"
            size="sm"
            className="w-20"
          />
        </div>
        <div>
          <FieldLabel>트랙 (선택)</FieldLabel>
          <Select value={track} onChange={(e) => setTrack(e.target.value)} size="sm">
            <option value="">전체</option>
            <option value="frontend">frontend</option>
            <option value="backend">backend</option>
            <option value="android">android</option>
          </Select>
        </div>
      </div>

      {hasCohort && (
        <Panel variant="card" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <SectionTitle as="h3">
              기수별 레포 순서 <span className="text-base-400 font-normal">({filteredRepos.length}개)</span>
            </SectionTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() => autoFillMutation.mutate()}
                disabled={autoFillMutation.isPending}
                tone="accent"
                size="sm"
              >
                {autoFillMutation.isPending ? '채우는 중...' : '자동 채우기'}
              </Button>
              <Button onClick={runCohortReposSync} disabled={stream.running} size="sm">
                {stream.running ? '싱크 중...' : '목록 전체 재 Sync'}
              </Button>
              {stream.running && (
                <Button onClick={stream.stop} tone="dangerSoft" size="sm">
                  중단
                </Button>
              )}
            </div>
          </div>

          <CohortRepoAddBar cohort={cohortNum} cohortRepos={cohortRepos} allRepos={allRepos} />

          {reposLoading ? (
            <EmptyState size="md">로딩 중...</EmptyState>
          ) : (
            <>
              {trackRepos.length > 0 && (
                <div>
                  {commonRepos.length > 0 && <p className="text-xs font-medium text-base-600 mb-1">트랙 미션</p>}
                  <CohortRepoTable repos={trackRepos} editor={editor} />
                </div>
              )}
              {commonRepos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-base-600 mb-1">공통 미션</p>
                  <CohortRepoTable repos={commonRepos} editor={editor} />
                </div>
              )}
              {filteredRepos.length === 0 && (
                <EmptyState size="md">등록된 레포가 없습니다. 자동 채우기를 사용하거나 직접 추가하세요.</EmptyState>
              )}

              {filteredRepos.length > 0 && (
                <div className="space-y-4 mt-6">
                  <h4 className="text-sm font-semibold text-base-700">레벨별 레포</h4>
                  {groupCohortReposByLevel(filteredRepos).map(({ level, repos }) => (
                    <div key={level ?? 'null'}>
                      <p className="text-xs font-medium text-base-600 mb-1">
                        {level !== null ? `Lv ${level}` : '미분류'}
                        <span className="text-base-400 font-normal ml-1">({repos.length}개)</span>
                      </p>
                      <CohortRepoTable repos={repos} editor={editor} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>
      )}

      {stream.logs.length > 0 && <StreamLogConsole logs={stream.logs} endRef={stream.logEndRef} className="max-h-48" />}
    </div>
  );
}
