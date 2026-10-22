import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// 실행 버튼. 색은 세 가지만: 주요(primary)·보조(secondary)·위험(danger). 대시보드에서 버튼 색이 의미를 갖게 한다.
// 예전 tone 이름(neutral·accent·success·positive·dangerSoft)은 셋 중 하나로 모았다 — 새 코드는 세 이름만 쓴다
const PRIMARY = 'bg-primary-600 text-white hover:bg-primary-700';
const SECONDARY = 'border border-base-300 bg-white text-base-700 hover:bg-base-50';
const DANGER = 'bg-danger-600 text-white hover:bg-danger-700';

export const buttonVariants = cva('rounded transition-colors disabled:opacity-40', {
  variants: {
    tone: {
      primary: PRIMARY,
      secondary: SECONDARY,
      danger: DANGER,
      neutral: SECONDARY,
      accent: PRIMARY,
      success: PRIMARY,
      positive: PRIMARY,
      dangerSoft: DANGER,
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
