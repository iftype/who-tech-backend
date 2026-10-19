import type { ComponentProps } from 'react';

import { cn } from '../../lib/cn.js';

// 상태 표시용 테두리 배지. tone은 의미(성공·실패·진행), emphasis는 강도(strong=상태, subtle=분류)를 고른다.
const BADGE_COLORS = {
  strong: {
    base: 'bg-base-100 text-base-500 border-base-200',
    primary: 'bg-primary-100 text-primary-700 border-primary-200',
    success: 'bg-success-100 text-success-700 border-success-200',
    danger: 'bg-danger-100 text-danger-700 border-danger-200',
    accent: 'bg-accent-100 text-accent-700 border-accent-200',
    highlight: 'bg-highlight-100 text-highlight-700 border-highlight-200',
  },
  subtle: {
    base: 'bg-base-50 text-base-500 border-base-200',
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    success: 'bg-success-50 text-success-700 border-success-200',
    accent: 'bg-accent-50 text-accent-700 border-accent-200',
    caution: 'bg-caution-50 text-caution-700 border-caution-200',
  },
} as const;

type Emphasis = keyof typeof BADGE_COLORS;
export type BadgeTone<E extends Emphasis = 'strong'> = keyof (typeof BADGE_COLORS)[E];

type BadgeStyle =
  { emphasis?: 'strong'; tone?: BadgeTone<'strong'> } | { emphasis: 'subtle'; tone?: BadgeTone<'subtle'> };

export function badgeVariants({ emphasis = 'strong', tone = 'base', className }: BadgeStyle & { className?: string }) {
  const colors: Record<string, string> = BADGE_COLORS[emphasis];
  return cn('text-xs px-1.5 py-0.5 rounded font-medium border', colors[tone], className);
}

export function Badge({ emphasis, tone, className, ...props }: ComponentProps<'span'> & BadgeStyle) {
  return <span className={badgeVariants({ emphasis, tone, className } as BadgeStyle)} {...props} />;
}
