import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// 색으로 채운 실행 버튼. tone은 동작의 성격, size는 놓이는 자리(툴바·폼)에 맞춰 고른다.
export const buttonVariants = cva('text-white rounded disabled:opacity-40', {
  variants: {
    tone: {
      primary: 'bg-primary-600 hover:bg-primary-700',
      neutral: 'bg-base-700 hover:bg-base-800',
      accent: 'bg-accent-600 hover:bg-accent-700',
      success: 'bg-success-600 hover:bg-success-700',
      positive: 'bg-positive-600 hover:bg-positive-700',
      danger: 'bg-danger-600 hover:bg-danger-700',
      // 확인 모달처럼 한 번 더 묻는 자리의 삭제
      dangerSoft: 'bg-danger-500 hover:bg-danger-600',
    },
    size: {
      xs: 'text-xs px-2 py-1',
      sm: 'text-xs px-3 py-1.5',
      md: 'text-sm px-3 py-1.5',
      lg: 'text-sm px-4 py-1.5',
    },
  },
  defaultVariants: { tone: 'primary', size: 'lg' },
});

export function Button({
  className,
  tone,
  size,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button className={buttonVariants({ tone, size, className })} {...props} />;
}
