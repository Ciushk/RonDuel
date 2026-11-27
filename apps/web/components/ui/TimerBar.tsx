'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';

export interface TimerBarProps {
  remainingMs: number;
  limitMs: number;
  label?: string;
  className?: string;
  paused?: boolean;
}

export function TimerBar({ remainingMs, limitMs, label, className, paused = false }: TimerBarProps) {
  const t = useTranslations();
  const clamped = Math.max(0, Math.min(limitMs, remainingMs));
  const pct = limitMs > 0 ? (clamped / limitMs) * 100 : 0;
  const secondsLeft = Math.ceil(clamped / 1000);
  const isUrgent = !paused && clamped > 0 && clamped <= 3_000;

  return (
    <div className={cn('w-full space-y-1', className)} data-paused={paused ? 'true' : 'false'}>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-muted">{label || t('play.timeLeft')}</span>
        <span
          data-testid="timer-seconds"
          className={cn('rd-tabular text-sm font-bold', isUrgent ? 'text-ron-strong' : 'text-ink')}
        >
          {secondsLeft}s
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('a11y.timeRemaining')}
        aria-valuemin={0}
        aria-valuemax={Math.ceil(limitMs / 1000)}
        aria-valuenow={secondsLeft}
        className="border-border bg-surface-2 h-3 w-full overflow-hidden rounded-full border-2"
      >
        <div
          className={cn(
            'h-full rounded-full',
            paused ? 'transition-none' : 'transition-[width] duration-100 ease-linear',
            isUrgent ? 'bg-ron animate-pulse' : 'bg-duel',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
