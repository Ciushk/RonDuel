import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'sticker' | 'subtle' | 'secondary';
}

const VARIANT_CLASSES = {
  sticker: 'bg-surface rd-sticker',
  subtle: 'bg-surface border border-border-subtle',
  secondary: 'bg-surface-2 border border-border-subtle',
};

export function Card({ className, variant = 'sticker', ...props }: CardProps) {
  return (
    <div className={cn('rounded-[20px] p-5', VARIANT_CLASSES[variant], className)} {...props} />
  );
}
