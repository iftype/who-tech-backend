import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/cn.js';

// 폼 입력 요소. size는 놓이는 자리(툴바 sm·폼 md, 표 안 xs)에 맞춰 고른다.
export const fieldVariants = cva('border border-base-300 rounded text-sm', {
  variants: {
    size: { xs: 'px-2 py-1', sm: 'px-2 py-1.5', md: 'px-3 py-1.5' },
  },
  defaultVariants: { size: 'md' },
});

const labelVariants = cva('text-xs block mb-1', {
  variants: { tone: { muted: 'text-base-500', default: 'text-base-600' } },
  defaultVariants: { tone: 'muted' },
});

type FieldSize = VariantProps<typeof fieldVariants>;

export function TextInput({ className, size, ...props }: Omit<ComponentProps<'input'>, 'size'> & FieldSize) {
  return <input className={fieldVariants({ size, className })} {...props} />;
}

export function Select({ className, size, ...props }: Omit<ComponentProps<'select'>, 'size'> & FieldSize) {
  return <select className={fieldVariants({ size, className })} {...props} />;
}

export function FieldLabel({
  className,
  tone,
  ...props
}: ComponentProps<'label'> & VariantProps<typeof labelVariants>) {
  return <label className={labelVariants({ tone, className })} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return <input type="checkbox" className={cn('rounded', className)} {...props} />;
}
