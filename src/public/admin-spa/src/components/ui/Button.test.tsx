import { describe, expect, it } from 'vitest';
import { buttonVariants } from './Button';

const classSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

describe('buttonVariants', () => {
  it('should match the hand-written solid button classes', () => {
    expect(classSet(buttonVariants())).toEqual(
      classSet('bg-primary-600 text-white text-sm rounded px-4 py-1.5 hover:bg-primary-700 disabled:opacity-40'),
    );
    expect(classSet(buttonVariants({ tone: 'neutral', size: 'md' }))).toEqual(
      classSet('bg-base-700 text-white text-sm rounded px-3 py-1.5 hover:bg-base-800 disabled:opacity-40'),
    );
    expect(classSet(buttonVariants({ tone: 'dangerSoft', size: 'sm', className: 'mb-4' }))).toEqual(
      classSet('bg-danger-500 text-white text-xs rounded px-3 py-1.5 hover:bg-danger-600 disabled:opacity-40 mb-4'),
    );
  });
});
