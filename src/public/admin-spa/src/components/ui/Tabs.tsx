import { cva, type VariantProps } from 'class-variance-authority';

// 내비 한 칸. 좁은 화면: 위쪽 가로 탭(밑줄), 넓은 화면(md~): 사이드바 세로 목록(배경으로 활성 표시).
// 같은 요소를 한 번만 그리고 화면 폭으로 모양만 바꾼다
export const tabVariants = cva(
  'whitespace-nowrap text-sm font-medium transition-colors px-4 py-3 border-b-2 -mb-px md:mb-0 md:w-full md:rounded-md md:border-b-0 md:px-3 md:py-2 md:text-left',
  {
    variants: {
      active: {
        true: 'border-primary-600 text-primary-600 md:bg-primary-50 md:text-primary-700',
        false: 'border-transparent text-base-500 hover:text-base-700 md:hover:bg-base-100',
      },
    },
    defaultVariants: { active: false },
  },
);

export type TabStyle = VariantProps<typeof tabVariants>;
