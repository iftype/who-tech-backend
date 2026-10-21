import { cva, type VariantProps } from 'class-variance-authority';

// 상단 탭 한 칸. 활성 탭만 밑줄·색. 좁은 화면에서는 줄을 바꾸지 않고 가로로 넘긴다(nav가 overflow-x-auto)
export const tabVariants = cva('px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors', {
  variants: {
    active: {
      true: 'border-primary-600 text-primary-600',
      false: 'border-transparent text-base-500 hover:text-base-700',
    },
  },
  defaultVariants: { active: false },
});

export type TabStyle = VariantProps<typeof tabVariants>;
