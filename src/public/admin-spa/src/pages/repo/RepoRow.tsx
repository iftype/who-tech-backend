import type { ReactNode } from 'react';

import type { MissionRepo } from '../../lib/types.js';
import { Td, Tr } from '../../components/ui/Table.js';
import { Badge, badgeVariants, type BadgeTone } from '../../components/ui/Badge.js';
import { EditableSelectCell, EditableTextCell, SyncProgress } from './RepoCells.js';
import { TAB_CATEGORY_OPTIONS, TRACK_OPTIONS, TYPE_OPTIONS, type EditableField } from './repo-options.js';
import type { RepoEditing } from './useRepoEditing.js';
import type { RepoSelection } from './useRepoSelection.js';
import type { RepoSync } from './useRepoSync.js';
import { TextLink } from '../../components/ui/TextLink.js';
import { Checkbox } from '../../components/ui/Field.js';

const REPO_STATUS_TONE: Record<string, BadgeTone> = { active: 'success', candidate: 'highlight', excluded: 'danger' };
// 제외(excluded)는 강조 없이 기본 회색 배지로 둔다
const TAB_CATEGORY_TONE: Record<string, BadgeTone<'subtle'>> = {
  base: 'primary',
  common: 'accent',
  precourse: 'caution',
};
const TAB_CATEGORY_LABELS: Record<string, string> = {
  base: '기준',
  common: '공통',
  precourse: '프리코스',
  excluded: '제외',
};
const CELL_CLASS = 'px-3 py-2 cursor-pointer hover:bg-primary-50 transition-colors duration-100';

function TabCategoryBadge({ category }: { category: string }) {
  const tone = TAB_CATEGORY_TONE[category];
  const label = TAB_CATEGORY_LABELS[category] ?? category;
  return tone ? (
    <Badge emphasis="subtle" tone={tone}>
      {label}
    </Badge>
  ) : (
    <Badge>{label}</Badge>
  );
}

interface Props {
  repo: MissionRepo;
  editing: RepoEditing;
  sync: RepoSync;
  selection: RepoSelection;
}

export function RepoRow({ repo: r, editing, sync, selection }: Props) {
  const isSyncing = sync.syncingRepos.has(r.id);
  const activeJob = sync.activeJobs.get(r.id);

  // 누르면 편집으로 바뀌는 칸
  const editableCell = (field: EditableField, editor: ReactNode, view: ReactNode, className = '') => (
    <Td density="none" className={`${CELL_CLASS}${className}`} onClick={() => editing.startEdit(r.id, field)}>
      {editing.isEditing(r.id, field) ? editor : view}
    </Td>
  );
  const selectEditor = (field: EditableField, value: string, options: typeof TRACK_OPTIONS) => (
    <EditableSelectCell
      value={value}
      options={options}
      onSave={(v) => editing.save(r, field, v)}
      onCancel={editing.cancel}
      saving={editing.isSaving(r.id, field)}
    />
  );
  const textEditor = (field: EditableField, value: string, placeholder: string) => (
    <EditableTextCell
      value={value}
      placeholder={placeholder}
      onSave={(v) => editing.save(r, field, v)}
      onCancel={editing.cancel}
      saving={editing.isSaving(r.id, field)}
    />
  );

  return (
    <Tr>
      <Td>
        <Checkbox
          checked={selection.selectedRepoIds.has(r.id)}
          onChange={() => selection.toggle(r.id)}
          className="border-base-300"
        />
      </Td>
      <Td>
        <TextLink href={r.repoUrl} target="_blank" rel="noopener noreferrer" className="font-medium">
          {r.name}
        </TextLink>
        {activeJob && <SyncProgress job={activeJob} />}
      </Td>
      {editableCell(
        'track',
        selectEditor('track', r.track ?? '', TRACK_OPTIONS),
        <span className="text-xs text-base-600">{r.track || '공통'}</span>,
      )}
      {editableCell(
        'type',
        selectEditor('type', r.type, TYPE_OPTIONS),
        <span className="text-xs text-base-600">{r.type === 'integration' ? '통합' : '개인'}</span>,
      )}
      {editableCell(
        'tabCategory',
        selectEditor('tabCategory', r.tabCategory, TAB_CATEGORY_OPTIONS),
        <TabCategoryBadge category={r.tabCategory} />,
      )}
      <Td>
        <button
          onClick={() => editing.toggleStatus(r)}
          title="클릭하여 상태 전환 (active → candidate → excluded → active)"
          className={badgeVariants({
            tone: REPO_STATUS_TONE[r.status] ?? 'base',
            className: 'cursor-pointer hover:scale-105 transition-transform',
          })}
        >
          {r.status}
        </button>
      </Td>
      <Td>
        <button
          onClick={() => void editing.toggleSyncMode(r)}
          title="클릭하여 전환"
          className={
            r.syncMode === 'continuous'
              ? badgeVariants({ emphasis: 'subtle', tone: 'accent', className: 'hover:bg-accent-100' })
              : badgeVariants({ emphasis: 'subtle', tone: 'base', className: 'hover:bg-base-100' })
          }
        >
          {r.syncMode === 'continuous' ? '연속' : '1회'}
        </button>
      </Td>
      {editableCell(
        'cohorts',
        textEditor('cohorts', r.cohorts.join(', '), '6, 7, 8'),
        <span className="text-xs text-base-500">{r.cohorts.join(', ') || '—'}</span>,
      )}
      {editableCell(
        'description',
        textEditor('description', r.description ?? '', '설명 입력'),
        <span className="text-xs text-base-500 truncate block" title={r.description ?? undefined}>
          {r.description || '—'}
        </span>,
        ' max-w-[200px]',
      )}
      <Td className="text-xs text-base-500 whitespace-nowrap">
        {r.lastSyncAt
          ? new Date(r.lastSyncAt).toLocaleString('ko-KR', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '—'}
      </Td>
      <Td className="text-xs text-base-600">{r._count.submissions}</Td>
      <Td>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => void sync.syncRepo(r)}
            disabled={isSyncing}
            className="text-2xs px-2 py-1 rounded border border-primary-300 text-primary-600 hover:bg-primary-50 disabled:opacity-40"
            title="싱크"
          >
            {isSyncing ? '...' : '싱크'}
          </button>
          <button
            onClick={() => editing.resetLastSyncAt(r.id)}
            className="text-2xs px-2 py-1 rounded border border-warning-300 text-warning-600 hover:bg-warning-50"
            title="lastSyncAt 초기화 (전체 재싱크)"
          >
            초기화
          </button>
          <button
            onClick={() => void editing.remove(r)}
            disabled={editing.deleting === r.id}
            className="text-2xs px-2 py-1 rounded border border-danger-300 text-danger-500 hover:bg-danger-50 disabled:opacity-40"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </Td>
    </Tr>
  );
}
