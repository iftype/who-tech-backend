import { useState, useMemo } from 'react';

type SortDirection = 'asc' | 'desc';

interface SortOptions<T, K extends string> {
  initialKey: K;
  initialDir?: SortDirection;
  // 중첩 값(_count.submissions 등)을 꺼내는 방법. 없으면 item[key]
  getValue?: (item: T, key: K) => unknown;
}

const readField = (item: unknown, key: string): unknown => (item as Record<string, unknown>)[key];

// 빈 값(null·undefined)은 방향과 상관없이 맨 뒤로 보낸다
export function useSortableData<T, K extends string>(items: T[], options: SortOptions<T, K>) {
  const { initialKey, initialDir = 'asc', getValue = readField } = options;
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<SortDirection>(initialDir);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const av = getValue(a, sortKey) as string | number | null | undefined;
        const bv = getValue(b, sortKey) as string | number | null | undefined;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      }),
    // getValue는 매 렌더 새로 만들지 않도록 모듈 상수로 넘긴다
    [items, sortKey, sortDir, getValue],
  );

  const toggle = (key: K) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return { sorted, sortKey, sortDir, toggle };
}
