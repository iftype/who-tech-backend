import { describe, expect, it } from 'vitest';
import { badgeVariants } from './Badge';

const classSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
const BASE = 'text-xs px-1.5 py-0.5 rounded font-medium border';

describe('badgeVariants', () => {
  it('should match the hand-written status badge classes', () => {
    expect(classSet(badgeVariants({}))).toEqual(classSet(`${BASE} bg-base-100 text-base-500 border-base-200`));
    expect(classSet(badgeVariants({ tone: 'success' }))).toEqual(
      classSet(`${BASE} bg-success-100 text-success-700 border-success-200`),
    );
    expect(classSet(badgeVariants({ emphasis: 'subtle', tone: 'accent', className: 'hover:bg-accent-100' }))).toEqual(
      classSet(`${BASE} bg-accent-50 text-accent-700 border-accent-200 hover:bg-accent-100`),
    );
  });
});
