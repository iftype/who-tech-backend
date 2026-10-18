// RepoTab 공용 타입·선택지
export type StatusFilter = '' | 'active' | 'candidate' | 'excluded';
export type TabCategoryFilter = '' | 'base' | 'common' | 'precourse' | 'excluded';

export type EditableField = 'track' | 'type' | 'tabCategory' | 'cohorts' | 'description';
export type EditingCell = { repoId: number; field: EditableField } | null;

export interface SelectOption {
  value: string;
  label: string;
}

export const TRACK_OPTIONS: SelectOption[] = [
  { value: '', label: '공통' },
  { value: 'frontend', label: 'frontend' },
  { value: 'backend', label: 'backend' },
  { value: 'android', label: 'android' },
];

export const TYPE_OPTIONS: SelectOption[] = [
  { value: 'individual', label: '개인' },
  { value: 'integration', label: '통합' },
];

export const TAB_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'base', label: '기준' },
  { value: 'common', label: '공통' },
  { value: 'precourse', label: '프리코스' },
  { value: 'excluded', label: '제외' },
];

export const STATUS_CYCLE: Record<string, string> = {
  active: 'candidate',
  candidate: 'excluded',
  excluded: 'active',
};
