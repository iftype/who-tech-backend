import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyState, Panel, SectionTitle } from './Section';
import { FieldLabel, Select, TextInput } from './Field';

const classSet = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
const set = (s: string) => new Set(s.split(' '));

describe('Section and Field', () => {
  it('should render the same classes the hand-written elements used', () => {
    const { container } = render(
      <>
        <SectionTitle as="h3" className="mb-3">
          제목
        </SectionTitle>
        <SectionTitle size="sm">작은 제목</SectionTitle>
        <Panel>회색 묶음</Panel>
        <Panel variant="card">카드</Panel>
        <EmptyState size="md">없음</EmptyState>
        <FieldLabel tone="default">이름</FieldLabel>
        <TextInput size="sm" className="w-20" />
        <Select>
          <option>a</option>
        </Select>
      </>,
    );
    const divs = container.querySelectorAll('div');

    expect(container.querySelector('h3')).not.toBeNull();
    expect(classSet(container.querySelector('h3'))).toEqual(set('text-sm font-semibold text-base-700 mb-3'));
    expect(classSet(container.querySelector('h2'))).toEqual(set('text-xs font-semibold text-base-600'));
    expect(classSet(divs[0])).toEqual(set('bg-base-50 border border-base-200 rounded p-3'));
    expect(classSet(divs[1])).toEqual(set('bg-white border border-base-200 rounded p-4'));
    expect(classSet(divs[2])).toEqual(set('py-8 text-center text-base-400 text-sm'));
    expect(classSet(container.querySelector('label'))).toEqual(set('text-xs text-base-600 block mb-1'));
    expect(classSet(container.querySelector('input'))).toEqual(
      set('border border-base-300 rounded px-2 py-1.5 text-sm w-20'),
    );
    expect(classSet(container.querySelector('select'))).toEqual(
      set('border border-base-300 rounded px-3 py-1.5 text-sm'),
    );
  });
});
