import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../components/ui/Toast.js';
import { RepoTable } from './repo/RepoTable.js';
import { RepoBatchBar } from './repo/RepoBatchBar.js';
import type { StatusFilter, TabCategoryFilter } from './repo/repo-options.js';
import { useRepoEditing } from './repo/useRepoEditing.js';
import { useRepoSelection } from './repo/useRepoSelection.js';
import { useRepoSync } from './repo/useRepoSync.js';
import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/Section.js';

const STATUS_FILTERS: StatusFilter[] = ['', 'active', 'candidate', 'excluded'];
const TAB_CATEGORY_FILTERS: TabCategoryFilter[] = ['', 'base', 'common', 'precourse', 'excluded'];
const filterButtonClass = (active: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-semibold ${
    active ? 'bg-console-900 text-white' : 'bg-console-100 text-console-500 hover:bg-console-200'
  }`;
const brandButtonClass =
  'bg-gradient-to-br from-brand-teal to-brand-sky text-white rounded-xl px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-40';

function RepoStatusLegend() {
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-console-200/60 rounded-2xl px-4 py-3 text-xs text-console-600">
      <div className="font-semibold text-console-700 mb-1.5">상태 설명</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <Badge tone="success" className="inline-block mr-1">
            active
          </Badge>{' '}
          전체 싱크 대상에 포함됨
        </span>
        <span>
          <Badge tone="highlight" className="inline-block mr-1">
            candidate
          </Badge>{' '}
          후보 상태, 수동으로 active로 승인 필요
        </span>
        <span>
          <Badge tone="danger" className="inline-block mr-1">
            excluded
          </Badge>{' '}
          싱크 대상에서 제외됨
        </span>
      </div>
    </div>
  );
}

export default function RepoTab() {
  const [status, setStatus] = useState<StatusFilter>('');
  const [tabCategory, setTabCategory] = useState<TabCategoryFilter>('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const editing = useRepoEditing();
  const sync = useRepoSync();
  const selection = useRepoSelection();

  const { data: repos = [], isLoading } = useQuery({
    queryKey: queryKeys.repos.byStatus(status),
    queryFn: () => adminApi.repos.list(status ? `?status=${status}` : ''),
  });

  const q = searchQuery.trim().toLowerCase();
  const searchedRepos = q ? repos.filter((r) => r.name.toLowerCase().includes(q)) : repos;
  const filteredRepos = tabCategory ? searchedRepos.filter((r) => r.tabCategory === tabCategory) : searchedRepos;

  const invalidateRepos = () => void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });

  const discoverMutation = useMutation({
    mutationFn: () => adminApi.repos.discover(),
    onSuccess: (result) => {
      showToast(`탐색 완료 — ${result.discovered}개 발견, ${result.created}개 생성, ${result.updated}개 갱신`);
      invalidateRepos();
    },
    meta: { errorMessage: '탐색 실패' },
  });

  const continuousSyncMutation = useMutation({
    mutationFn: () => adminApi.sync.continuous(),
    onSuccess: (result) => {
      if ('status' in result) {
        showToast('연속 싱크가 큐에서 실행 대기 중입니다 — 싱크 탭에서 확인하세요');
        return;
      }
      showToast(`연속 싱크 완료 — ${result.totalSynced}건, ${result.reposSynced}개 레포`);
      invalidateRepos();
    },
    meta: { errorMessage: '연속 싱크 실패' },
  });

  const tableProps = { editing, sync, selection };

  return (
    <div className="space-y-6">
      <RepoStatusLegend />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={filterButtonClass(status === s)}>
              {s || '전체 상태'}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {TAB_CATEGORY_FILTERS.map((c) => (
            <button key={c} onClick={() => setTabCategory(c)} className={filterButtonClass(tabCategory === c)}>
              {c || '전체 카테고리'}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="레포 검색..."
          className="border border-base-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
        <span className="text-xs text-base-400">{filteredRepos.length}개</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => void continuousSyncMutation.mutate()}
            disabled={continuousSyncMutation.isPending || sync.isBusy}
            className="bg-accent-600 text-white rounded-xl px-3 py-1.5 text-sm hover:bg-accent-700 disabled:opacity-40"
          >
            {continuousSyncMutation.isPending ? '연속 싱크 중...' : '연속 싱크'}
          </button>
          <button onClick={() => void sync.syncAllBase(repos)} disabled={sync.isBusy} className={brandButtonClass}>
            Base 전체 싱크
          </button>
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className={brandButtonClass}
          >
            {discoverMutation.isPending ? '탐색 중...' : '레포 탐색'}
          </button>
        </div>
      </div>

      {selection.selectedRepoIds.size > 0 && <RepoBatchBar selection={selection} />}

      {isLoading ? (
        <EmptyState>로딩 중...</EmptyState>
      ) : (
        <>
          <RepoTable
            repos={filteredRepos.filter((r) => r.syncMode === 'continuous')}
            title="자동수집 레포"
            emptyMessage="자동수집 레포가 없습니다"
            {...tableProps}
          />
          <RepoTable
            repos={filteredRepos.filter((r) => r.syncMode === 'once')}
            title="1회수집 레포"
            emptyMessage="1회수집 레포가 없습니다"
            {...tableProps}
          />
        </>
      )}
    </div>
  );
}
