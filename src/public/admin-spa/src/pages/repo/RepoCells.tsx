import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyncJob } from '../../lib/types.js';
import type { SelectOption } from './repo-options.js';

// 표 칸 안에서 바로 고치는 입력칸·선택칸
const INLINE_EDIT_CLASS =
  'text-xs border border-primary-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400 w-full disabled:opacity-50';

export function EditableSelectCell({
  value,
  options,
  onSave,
  onCancel,
  saving,
}: {
  value: string;
  options: SelectOption[];
  onSave: (v: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <select
      ref={ref}
      defaultValue={value}
      disabled={saving}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      className={INLINE_EDIT_CLASS}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EditableTextCell({
  value,
  onSave,
  onCancel,
  saving,
  type = 'text',
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  saving: boolean;
  type?: 'text' | 'number';
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleSave = useCallback(() => {
    onSave(localValue);
  }, [localValue, onSave]);

  return (
    <input
      ref={ref}
      type={type}
      value={localValue}
      disabled={saving}
      placeholder={placeholder}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        }
        if (e.key === 'Escape') {
          onCancel();
        }
      }}
      className={INLINE_EDIT_CLASS}
    />
  );
}

export function SyncProgress({ job }: { job: SyncJob }) {
  const pct = job.progress?.percent ?? 0;
  const phase = job.progress?.phase ?? job.message ?? '';
  return (
    <div className="mt-1">
      <div className="text-[11px] text-console-500 mb-0.5">
        {pct}% — {phase}
      </div>
      <div className="w-full h-1.5 bg-console-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-teal to-brand-sky rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
