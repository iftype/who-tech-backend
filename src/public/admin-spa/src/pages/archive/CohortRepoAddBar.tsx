import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { Button } from '../../components/ui/Button.js';
import { Select, TextInput } from '../../components/ui/Field.js';
import type { CohortRepo, MissionRepo } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';

interface Props {
  cohort: number;
  cohortRepos: CohortRepo[];
  allRepos: MissionRepo[];
}

// 아직 이 기수에 없는 미션 레포를 이름·트랙으로 찾아 추가한다
export function CohortRepoAddBar({ cohort, cohortRepos, allRepos }: Props) {
  const queryClient = useQueryClient();
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const addRepoMutation = useMutation({
    mutationFn: (missionRepoId: number) => adminApi.cohortRepos.create(cohort, missionRepoId),
    onSuccess: () => {
      showToast('레포 추가 완료');
      setSelectedRepoId('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.cohortRepos.all() });
    },
    meta: { errorMessage: '추가 실패' },
  });

  const handleAddRepo = () => {
    const id = Number(selectedRepoId);
    if (!id || isNaN(id)) {
      showToast('레포를 선택하세요', 'error');
      return;
    }
    addRepoMutation.mutate(id);
  };

  const existingRepoIds = new Set(cohortRepos.map((cr) => cr.missionRepoId));
  const q = searchQuery.trim().toLowerCase();
  const availableRepos = allRepos
    .filter((r) => !existingRepoIds.has(r.id))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.track?.toLowerCase().includes(q) ?? false));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TextInput
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setSelectedRepoId('');
        }}
        placeholder="레포 검색..."
        size="sm"
        className="w-40"
      />
      <Select
        value={selectedRepoId}
        onChange={(e) => setSelectedRepoId(e.target.value)}
        size="sm"
        className="min-w-[200px]"
      >
        <option value="">레포 선택 ({availableRepos.length}개)</option>
        {availableRepos.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} {r.track ? `(${r.track})` : ''}
          </option>
        ))}
      </Select>
      <Button onClick={handleAddRepo} disabled={addRepoMutation.isPending || !selectedRepoId} tone="neutral" size="sm">
        {addRepoMutation.isPending ? '추가 중...' : '추가'}
      </Button>
    </div>
  );
}
