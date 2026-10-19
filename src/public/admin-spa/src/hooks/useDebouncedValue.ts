import { useEffect, useState } from 'react';

// 값이 delay 동안 바뀌지 않을 때만 새 값을 돌려준다 (검색어를 칠 때마다 요청하지 않게)
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
