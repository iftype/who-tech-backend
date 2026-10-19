import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Table, TableFrame, TBody, THead, Td, Th } from './Table';

const classSet = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

describe('Table', () => {
  it('should render the same classes the hand-written tables used', () => {
    const { container } = render(
      <TableFrame>
        <Table size="xs">
          <THead className="sticky">
            <tr>
              <Th>기본</Th>
              <Th density="compact" size="11" className="w-6">
                작게
              </Th>
              <Th density="tight" size="inherit">
                표 크기
              </Th>
            </tr>
          </THead>
          <TBody>
            <tr>
              <Td className="text-xs">a</Td>
              <Td density="none" className="px-4">
                b
              </Td>
            </tr>
          </TBody>
        </Table>
      </TableFrame>,
    );
    const [th1, th2, th3] = container.querySelectorAll('th');
    const [td1, td2] = container.querySelectorAll('td');

    expect(classSet(container.querySelector('div'))).toEqual(
      new Set(['overflow-x-auto', 'rounded', 'border', 'border-base-200']),
    );
    expect(classSet(container.querySelector('table'))).toEqual(new Set(['w-full', 'text-xs']));
    expect(classSet(container.querySelector('thead'))).toEqual(
      new Set(['bg-base-50', 'border-b', 'border-base-200', 'sticky']),
    );
    expect(classSet(container.querySelector('tbody'))).toEqual(new Set(['divide-y', 'divide-base-100']));
    expect(classSet(th1)).toEqual(new Set(['text-left', 'text-xs', 'font-medium', 'text-base-500', 'px-3', 'py-2']));
    expect(classSet(th2)).toEqual(
      new Set(['text-left', 'text-[11px]', 'font-medium', 'text-base-500', 'px-1.5', 'py-1', 'w-6']),
    );
    expect(classSet(th3)).toEqual(new Set(['text-left', 'font-medium', 'text-base-500', 'px-2', 'py-1']));
    expect(classSet(td1)).toEqual(new Set(['px-3', 'py-2', 'text-xs']));
    expect(classSet(td2)).toEqual(new Set(['px-4']));
  });
});
