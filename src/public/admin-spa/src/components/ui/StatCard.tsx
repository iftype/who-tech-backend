import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/cn.js';
import { Panel } from './Section.js';

// 상태 카드: 이름 · 큰 값 · (선택) 오른쪽 작은 배지 · 아래 보조 문구. 멤버 탭·싱크 탭이 같은 카드를 쓴다
const valueVariants = cva('mt-1 font-semibold text-base-900', {
  variants: { size: { lg: 'text-xl', md: 'text-sm font-medium text-base-700' } },
  defaultVariants: { size: 'lg' },
});

// 카드·헤더의 작은 상태 배지 (GitHub API 정상/오류 등)
export const statBadgeVariants = cva('text-[10px] px-1.5 py-0.5 rounded font-medium', {
  variants: {
    tone: {
      base: 'bg-base-100 text-base-500',
      success: 'bg-success-100 text-success-700',
      caution: 'bg-caution-100 text-caution-700',
      danger: 'bg-danger-100 text-danger-700',
    },
  },
  defaultVariants: { tone: 'base' },
});

interface StatCardProps extends VariantProps<typeof valueVariants> {
  label: ReactNode;
  value: ReactNode;
  /** 이름 오른쪽의 작은 배지 */
  aside?: ReactNode;
  /** 값 아래 보조 문구 */
  hint?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, aside, hint, size, className }: StatCardProps) {
  return (
    <Panel variant="cardLg" className={cn('shadow-sm', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-base-500">{label}</p>
        {aside}
      </div>
      <p className={valueVariants({ size })}>{value}</p>
      {hint && <p className="text-[10px] text-base-400">{hint}</p>}
    </Panel>
  );
}

/** 상태 카드 묶음의 반응형 격자. 카드 수에 따라 넓은 화면 열 수를 고른다 */
export function StatGrid({
  columns,
  className,
  children,
}: {
  columns: 3 | 5;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3',
        columns === 3 ? 'sm:grid-cols-3' : 'md:grid-cols-3 xl:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
