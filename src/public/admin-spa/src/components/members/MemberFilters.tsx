import { type ChangeEvent } from 'react';
import type { MemberFilters } from '../../hooks/useMembers.js';

interface Props {
  filters: MemberFilters;
  onChange: (f: MemberFilters) => void;
}

export default function MemberFiltersBar({ filters, onChange }: Props) {
  const set = (key: keyof MemberFilters, value: unknown) =>
    onChange({ ...filters, [key]: value || undefined });

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <input
        type="text"
        placeholder="검색 (닉네임/깃허브ID)"
        value={filters.q ?? ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => set('q', e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48"
      />
      <select
        value={filters.role ?? ''}
        onChange={(e) => set('role', e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm"
      >
        <option value="">전체 역할</option>
        <option value="crew">크루</option>
        <option value="coach">코치</option>
        <option value="reviewer">리뷰어</option>
      </select>
      <select
        value={filters.hasBlog === undefined ? '' : String(filters.hasBlog)}
        onChange={(e) =>
          onChange({
            ...filters,
            hasBlog: e.target.value === '' ? undefined : e.target.value === 'true',
          })
        }
        className="border border-gray-300 rounded px-3 py-1.5 text-sm"
      >
        <option value="">블로그 전체</option>
        <option value="true">있음</option>
        <option value="false">없음</option>
      </select>
      <select
        value={filters.hasCohort === undefined ? '' : String(filters.hasCohort)}
        onChange={(e) =>
          onChange({
            ...filters,
            hasCohort: e.target.value === '' ? undefined : e.target.value === 'true',
          })
        }
        className="border border-gray-300 rounded px-3 py-1.5 text-sm"
      >
        <option value="">기수 전체</option>
        <option value="true">확정</option>
        <option value="false">미확정</option>
      </select>
      <button
        onClick={() => onChange({})}
        className="text-xs text-gray-400 hover:text-gray-600 px-2"
      >
        초기화
      </button>
    </div>
  );
}
