import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/cn.js';

// 어드민 표의 공통 골격. 밀도(density)는 행 하나에 담는 정보량에 맞춰 고른다.
const tableVariants = cva('w-full', {
  variants: { size: { sm: 'text-sm', xs: 'text-xs' } },
  defaultVariants: { size: 'sm' },
});

const cellDensity = {
  md: 'px-3 py-2',
  tight: 'px-2 py-1',
  compact: 'px-1.5 py-1',
  none: '',
} as const;

const thVariants = cva('text-left font-medium text-base-500', {
  variants: {
    density: cellDensity,
    // inherit: 표 크기(text-sm/xs)를 그대로 따른다
    size: { xs: 'text-xs', '11': 'text-2xs', inherit: '' },
  },
  defaultVariants: { density: 'md', size: 'xs' },
});

const tdVariants = cva('', {
  variants: { density: cellDensity },
  defaultVariants: { density: 'md' },
});

export function TableFrame({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('overflow-x-auto rounded border border-base-200', className)} {...props} />;
}

export function Table({ className, size, ...props }: ComponentProps<'table'> & VariantProps<typeof tableVariants>) {
  return <table className={tableVariants({ size, className })} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-base-50 border-b border-base-200', className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-base-100', className)} {...props} />;
}

// 마우스를 올리면 옅게 칠해지는 표의 한 줄
export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('hover:bg-base-50', className)} {...props} />;
}

export function Th({ className, density, size, ...props }: ComponentProps<'th'> & VariantProps<typeof thVariants>) {
  return <th className={thVariants({ density, size, className })} {...props} />;
}

export function Td({ className, density, ...props }: ComponentProps<'td'> & VariantProps<typeof tdVariants>) {
  return <td className={tdVariants({ density, className })} {...props} />;
}
