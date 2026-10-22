import { describe, expect, it } from 'vitest';
import { tabVariants } from './Tabs';

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
const BASE =
  'whitespace-nowrap text-sm font-medium transition-colors px-4 py-3 border-b-2 -mb-px md:mb-0 md:w-full md:rounded-md md:border-b-0 md:px-3 md:py-2 md:text-left';

describe('tabVariants', () => {
  it('should underline on narrow screens and fill the sidebar row on wide screens', () => {
    expect(set(tabVariants({ active: true }))).toEqual(
      set(`${BASE} border-primary-600 text-primary-600 md:bg-primary-50 md:text-primary-700`),
    );
    expect(set(tabVariants({ active: false }))).toEqual(
      set(`${BASE} border-transparent text-base-500 hover:text-base-700 md:hover:bg-base-100`),
    );
  });
});
