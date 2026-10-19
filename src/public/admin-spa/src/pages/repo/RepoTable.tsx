import type { MissionRepo } from '../../lib/types.js';
import { Table, TBody, THead, Th } from '../../components/ui/Table.js';
import { EmptyState, SectionTitle } from '../../components/ui/Section.js';
import { RepoRow } from './RepoRow.js';
import type { RepoEditing } from './useRepoEditing.js';
import type { RepoSelection } from './useRepoSelection.js';
import type { RepoSync } from './useRepoSync.js';

interface Props {
  repos: MissionRepo[];
  title: string;
  emptyMessage: string;
  editing: RepoEditing;
  sync: RepoSync;
  selection: RepoSelection;
}

export function RepoTable({ repos, title, emptyMessage, editing, sync, selection }: Props) {
  if (repos.length === 0) {
    return (
      <div className="space-y-2">
        <SectionTitle as="h3">{title}</SectionTitle>
        <EmptyState size="md" className="bg-white/90 backdrop-blur-sm border border-console-200/60 rounded-2xl">
          {emptyMessage}
        </EmptyState>
      </div>
    );
  }

  const allSelected = repos.every((r) => selection.selectedRepoIds.has(r.id));

  return (
    <div className="space-y-2">
      <SectionTitle as="h3">
        {title} <span className="text-base-400 font-normal">({repos.length}개)</span>
      </SectionTitle>
      <div className="overflow-x-auto rounded-2xl border border-console-200/60">
        <Table>
          <THead>
            <tr>
              <Th className="w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    selection.toggleAll(
                      repos.map((r) => r.id),
                      allSelected,
                    )
                  }
                  className="rounded border-base-300"
                />
              </Th>
              <Th>레포</Th>
              <Th>트랙</Th>
              <Th>타입</Th>
              <Th>카테고리</Th>
              <Th>상태</Th>
              <Th>모드</Th>
              <Th>기수</Th>
              <Th>설명</Th>
              <Th>마지막싱크</Th>
              <Th>제출</Th>
              <Th>작업</Th>
            </tr>
          </THead>
          <TBody>
            {repos.map((r) => (
              <RepoRow key={r.id} repo={r} editing={editing} sync={sync} selection={selection} />
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
