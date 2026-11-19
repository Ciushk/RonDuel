'use client';

import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';

import { cn } from '@/lib/cn';

export interface ToastProps {
  message: string;
  tone?: 'info' | 'success' | 'error';
  className?: string;
}

export function Toast({ message, tone = 'info', className }: ToastProps) {
  const Icon = tone === 'success' ? CheckCircle : tone === 'error' ? WarningCircle : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'border-border bg-surface text-ink inline-flex items-center gap-2.5 rounded-[14px] border-2 px-4 py-3 text-sm font-bold shadow-[var(--rd-shadow-sheet)]',
        className,
      )}
    >
      <Icon
        size={20}
        weight="fill"
        aria-hidden="true"
        className={cn(
          tone === 'success' && 'text-correct-text',
          tone === 'error' && 'text-wrong',
          tone === 'info' && 'text-duel-strong',
        )}
      />
      <span>{message}</span>
    </div>
  );
}
