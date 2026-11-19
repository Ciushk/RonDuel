import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type ChipTone = 'neutral' | 'volt' | 'red' | 'blue' | 'gold' | 'correct' | 'wrong';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

const TONE_CLASSES: Record<ChipTone, string> = {
  neutral: 'bg-surface-2 text-ink border border-border-subtle',
  volt: 'bg-volt text-[#16131F] border border-[#16131F]',
  red: 'bg-ron text-[#16131F] border border-[#16131F]',
  blue: 'bg-duel-strong text-[var(--rd-on-blue)] border border-transparent',
  gold: 'bg-gold text-[#16131F] border border-[#16131F]',
  correct: 'bg-correct text-[#16131F] border border-[#16131F]',
  wrong: 'bg-wrong text-[var(--rd-on-wrong)] border border-transparent',
};

export function Chip({ className, tone = 'neutral', ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-xs font-bold tracking-wide',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
