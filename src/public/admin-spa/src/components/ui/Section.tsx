import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// 화면 구획 요소: 구획 제목, 묶음 상자, 빈 상태 안내
const sectionTitleVariants = cva('font-semibold', {
  variants: { size: { md: 'text-sm text-base-700', sm: 'text-xs text-base-600' } },
  defaultVariants: { size: 'md' },
});

const panelVariants = cva('border border-base-200 rounded', {
  variants: {
    // inset: 화면 안에 들어간 회색 묶음, card: 흰 바탕 카드
    variant: { inset: 'bg-base-50 p-3', card: 'bg-white p-4' },
  },
  defaultVariants: { variant: 'inset' },
});

const emptyStateVariants = cva('text-center text-base-400 text-sm', {
  variants: { size: { md: 'py-8', lg: 'py-12' } },
  defaultVariants: { size: 'lg' },
});

type Heading = 'h2' | 'h3';

export function SectionTitle({
  as: Tag = 'h2',
  className,
  size,
  ...props
}: ComponentProps<'h2'> & VariantProps<typeof sectionTitleVariants> & { as?: Heading }) {
  return <Tag className={sectionTitleVariants({ size, className })} {...props} />;
}

export function Panel({ className, variant, ...props }: ComponentProps<'div'> & VariantProps<typeof panelVariants>) {
  return <div className={panelVariants({ variant, className })} {...props} />;
}

export function EmptyState({
  className,
  size,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof emptyStateVariants>) {
  return <div className={emptyStateVariants({ size, className })} {...props} />;
}
