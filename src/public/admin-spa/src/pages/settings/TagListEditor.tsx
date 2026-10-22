import { useState, type FormEvent } from 'react';
import { cva } from 'class-variance-authority';

import { Button } from '../../components/ui/Button.js';
import { TextInput } from '../../components/ui/Field.js';
import { SectionTitle } from '../../components/ui/Section.js';

// 금지어·무시 도메인처럼 "입력해서 추가, ✕로 삭제"하는 짧은 문자열 목록. 두 섹션이 같은 틀을 쓴다
const chipVariants = cva('inline-flex items-center gap-1 border text-xs rounded px-2 py-1', {
  variants: {
    tone: {
      danger: 'bg-danger-50 border-danger-200 text-danger-700',
      base: 'bg-base-100 border-base-300 text-base-700',
    },
  },
});
const removeVariants = cva('ml-0.5', {
  variants: { tone: { danger: 'hover:text-danger-900', base: 'hover:text-base-900' } },
});

interface TagListEditorProps {
  title: string;
  placeholder: string;
  tone: 'danger' | 'base';
  items: { id: number; label: string }[];
  onAdd: (value: string, done: () => void) => void;
  onRemove: (id: number) => void;
  adding: boolean;
}

export function TagListEditor({ title, placeholder, tone, items, onAdd, onRemove, adding }: TagListEditorProps) {
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim(), () => setValue(''));
  };

  return (
    <section>
      <SectionTitle className="mb-3">
        {title} ({items.length})
      </SectionTitle>
      <form onSubmit={submit} className="flex gap-2 mb-3">
        <TextInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="submit" disabled={adding || !value.trim()} tone="secondary" size="md">
          추가
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item.id} className={chipVariants({ tone })}>
            {item.label}
            <button
              onClick={() => onRemove(item.id)}
              aria-label={`${item.label} 삭제`}
              className={removeVariants({ tone })}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
