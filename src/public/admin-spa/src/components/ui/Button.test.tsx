import { describe, expect, it } from 'vitest';
import { buttonVariants } from './Button';

const classSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

// 버튼 색은 세 가지(주요·보조·위험). 예전 tone 이름은 셋 중 하나와 같은 클래스여야 한다
describe('buttonVariants', () => {
  it('should render the three tones', () => {
    expect(classSet(buttonVariants())).toEqual(
      classSet(
        'rounded transition-colors disabled:opacity-40 bg-primary-600 text-white hover:bg-primary-700 text-sm px-4 py-1.5',
      ),
    );
    expect(classSet(buttonVariants({ tone: 'secondary', size: 'md' }))).toEqual(
      classSet(
        'rounded transition-colors disabled:opacity-40 border border-base-300 bg-white text-base-700 hover:bg-base-50 text-sm px-3 py-1.5',
      ),
    );
    expect(classSet(buttonVariants({ tone: 'danger', size: 'sm', className: 'mb-4' }))).toEqual(
      classSet(
        'rounded transition-colors disabled:opacity-40 bg-danger-600 text-white hover:bg-danger-700 text-xs px-3 py-1.5 mb-4',
      ),
    );
  });

  it('should map the legacy tones onto the three', () => {
    const tone = (t: Parameters<typeof buttonVariants>[0]) => buttonVariants(t);
    expect(tone({ tone: 'neutral' })).toBe(tone({ tone: 'secondary' }));
    for (const t of ['accent', 'success', 'positive'] as const)
      expect(tone({ tone: t })).toBe(tone({ tone: 'primary' }));
    expect(tone({ tone: 'dangerSoft' })).toBe(tone({ tone: 'danger' }));
  });
});
