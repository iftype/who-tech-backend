import { describe, expect, it } from 'vitest';
import { tabVariants } from './Tabs';

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

// TabNav가 손으로 쓰던 클래스를 variant로 옮겼다. 집합이 같아야 화면이 같다 (whitespace-nowrap만 새로)
describe('tabVariants', () => {
  it('should keep the active and inactive tab classes', () => {
    expect(set(tabVariants({ active: true }))).toEqual(
      set(
        'px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors border-primary-600 text-primary-600',
      ),
    );
    expect(set(tabVariants({ active: false }))).toEqual(
      set(
        'px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors border-transparent text-base-500 hover:text-base-700',
      ),
    );
  });
});
