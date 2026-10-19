import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// 파란 글자 링크 (PR·글·레포 바로가기). size는 둘레 글자 크기에 맞춘다
export const linkVariants = cva('text-primary-600 hover:underline', {
  variants: { size: { xs: 'text-xs', sm: 'text-sm' } },
  defaultVariants: { size: 'xs' },
});

export function TextLink({ className, size, ...props }: ComponentProps<'a'> & VariantProps<typeof linkVariants>) {
  return <a className={linkVariants({ size, className })} {...props} />;
}
