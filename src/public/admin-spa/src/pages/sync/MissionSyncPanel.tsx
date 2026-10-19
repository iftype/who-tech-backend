import { useState } from 'react';

import { Button } from '../../components/ui/Button.js';
import { FieldLabel, TextInput } from '../../components/ui/Field.js';
import { Panel, SectionTitle } from '../../components/ui/Section.js';
import type { useSyncJobStream } from './useSyncJobStream.js';

type JobStream = ReturnType<typeof useSyncJobStream>;

// 미션 레포 싱크 실행. 기수를 넣으면 그 기수만, 비우면 전체
export function MissionSyncPanel({ stream }: { stream: JobStream }) {
  const [cohortInput, setCohortInput] = useState('');
  const { running, isEnqueuing, enqueue, stop } = stream;

  const runSync = () => enqueue({ type: 'workspace', ...(cohortInput ? { cohort: Number(cohortInput) } : {}) });
  const runContinuous = () => enqueue({ type: 'continuous' });
  const runCohortRepos = () => {
    if (!cohortInput) return;
    enqueue({ type: 'cohort-repos', cohort: Number(cohortInput) });
  };

  return (
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
          <Button onClick={runSync} disabled={isEnqueuing}>
            {isEnqueuing ? '큐 추가 중...' : cohortInput ? `${cohortInput}기 싱크` : '전체 싱크'}
          </Button>
          <Button onClick={runContinuous} disabled={isEnqueuing} tone="accent">
            {isEnqueuing ? '큐 추가 중...' : '연속 싱크'}
          </Button>
          <Button
            onClick={runCohortRepos}
            disabled={isEnqueuing || !cohortInput}
            tone="neutral"
            title={!cohortInput ? '기수를 입력하세요' : undefined}
          >
            {isEnqueuing ? '큐 추가 중...' : '기수 레포 업데이트'}
          </Button>
          {running && (
            <Button onClick={stop} tone="dangerSoft">
              중단
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
