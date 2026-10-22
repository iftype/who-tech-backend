import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ConfirmHost, confirmAction } from './ConfirmDialog';

describe('confirmAction', () => {
  it('should resolve true on confirm and false on cancel', async () => {
    render(<ConfirmHost />);

    let first!: Promise<boolean>;
    act(() => {
      first = confirmAction('삭제하시겠습니까?', { confirmLabel: '삭제', danger: true });
    });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('삭제하시겠습니까?');
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    await expect(first).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    let second!: Promise<boolean>;
    act(() => {
      second = confirmAction('계속하시겠습니까?');
    });
    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    await expect(second).resolves.toBe(false);
  });

  it('should cancel on Escape and when a newer request replaces it', async () => {
    render(<ConfirmHost />);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = confirmAction('A');
    });
    act(() => {
      second = confirmAction('B');
    });
    await expect(first).resolves.toBe(false);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('B');

    await userEvent.keyboard('{Escape}');
    await expect(second).resolves.toBe(false);
  });

  it('should treat a missing host as cancel so nothing destructive runs', async () => {
    await expect(confirmAction('삭제?')).resolves.toBe(false);
  });
});
