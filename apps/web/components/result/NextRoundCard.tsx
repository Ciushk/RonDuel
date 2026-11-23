'use client';

import { Clock, Flame } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  formatCountdown,
  isStreakMilestone,
  msUntilNextLocalMidnight,
  nextStreakMilestone,
  stripEmoji,
} from '@/lib/streak-milestones';

export interface NextRoundCardProps {
  streak: number;
  /** i18n key under `themes.*` for tomorrow's theme, when it is one of the known themes. */
  tomorrowThemeKey?: string;
  /** Raw theme text, used when the theme is custom (admin-scheduled). */
  tomorrowTopic?: string;
}

/**
 * Keeps the player coming back: countdown to the next round, a teaser of tomorrow's theme
 * and progress towards the next streak milestone (3 / 7 / 30 days).
 */
export function NextRoundCard({ streak, tomorrowThemeKey, tomorrowTopic }: NextRoundCardProps) {
  const t = useTranslations();
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setMsLeft(msUntilNextLocalMidnight());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const rawTheme = tomorrowThemeKey
    ? t(`themes.${tomorrowThemeKey}` as Parameters<typeof t>[0])
    : (tomorrowTopic ?? '');
  const theme = stripEmoji(rawTheme);
  const nextMilestone = nextStreakMilestone(streak);
  const reached = isStreakMilestone(streak);
  const countdown = msLeft === null ? '--:--:--' : formatCountdown(msLeft);
  // Screen readers get hours/minutes only; announcing every second would be noise.
  const srTime =
    msLeft === null
      ? ''
      : `${Math.floor(msLeft / 3_600_000)}:${String(Math.floor((msLeft % 3_600_000) / 60_000)).padStart(2, '0')}`;

  return (
    <div
      className="border-border-subtle bg-surface-2 space-y-3 rounded-2xl border p-3.5 text-left"
      data-testid="next-round-card"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Clock size={18} weight="bold" className="text-duel-strong shrink-0" aria-hidden="true" />
          <span>{t('retention.nextRoundLabel')}</span>
        </div>
        <span
          className="rd-tabular font-display text-ink text-lg font-extrabold"
          aria-hidden="true"
        >
          {countdown}
        </span>
        <span className="sr-only">{t('retention.countdownAria', { time: srTime })}</span>
      </div>

      {theme && (
        <p className="text-muted text-xs font-bold">{t('retention.tomorrowTeaser', { theme })}</p>
      )}

      {reached && (
        <p className="rd-milestone-glow bg-volt text-ink inline-flex items-center gap-1.5 rounded-full border-2 border-[#16131F] px-3 py-1 text-xs font-black text-[#16131F]">
          <Flame size={14} weight="fill" aria-hidden="true" />
          {t('retention.milestoneReached', { days: streak })}
        </p>
      )}

      {nextMilestone !== null && (
        <div className="space-y-1">
          <p className="text-xs font-bold">
            {t('retention.streakToMilestone', {
              days: nextMilestone - streak,
              milestone: nextMilestone,
            })}
          </p>
          <div
            role="progressbar"
            aria-label={t('retention.streakProgressAria', { milestone: nextMilestone })}
            aria-valuemin={0}
            aria-valuemax={nextMilestone}
            aria-valuenow={streak}
            className="bg-surface border-border-subtle h-2 w-full overflow-hidden rounded-full border"
          >
            <div
              className="rd-seam h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (streak / nextMilestone) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
