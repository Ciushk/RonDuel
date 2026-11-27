'use client';

import { Flame, X } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Chip } from '@/components/ui';
import type { WeekStripDay } from '@/lib/streak-logic';

interface StreakWeekStripProps {
  uid: string;
  date: string;
  streakCurrent: number;
  streakIncreasedToday?: boolean;
  streakBeforeToday?: number;
  freezes?: number;
  weeklyShieldAvailable?: boolean;
  weekStrip?: WeekStripDay[];
  onOpenFreezeSheet?: () => void;
}

const RO_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const EN_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function parseUtcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0));
}

function getWeekdayShortLetter(dateStr: string, index: number, locale: string): string {
  if (locale === 'ro') return RO_LETTERS[index] ?? '';
  if (locale === 'en') return EN_LETTERS[index] ?? '';
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'narrow',
      timeZone: 'UTC',
    })
      .format(parseUtcDate(dateStr))
      .toUpperCase();
  } catch {
    return EN_LETTERS[index] ?? '';
  }
}

function getWeekdayFullName(dateStr: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(parseUtcDate(dateStr));
  } catch {
    return dateStr;
  }
}

export function StreakWeekStrip({
  uid,
  date,
  streakCurrent,
  streakIncreasedToday = false,
  streakBeforeToday,
  freezes,
  weeklyShieldAvailable = false,
  weekStrip,
  onOpenFreezeSheet,
}: StreakWeekStripProps) {
  const t = useTranslations();
  const locale = useLocale();

  const [displayedStreak, setDisplayedStreak] = useState<number>(streakCurrent);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const animatedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setDisplayedStreak(streakCurrent);
  }, [streakCurrent]);

  useEffect(() => {
    if (!streakIncreasedToday || streakCurrent < 1 || !uid || !date) return;

    const storageKey = `rd_streak_anim_v1_${uid}_${date}`;
    if (animatedKeyRef.current === storageKey) return;

    let alreadyPlayed = false;
    try {
      alreadyPlayed = localStorage.getItem(storageKey) === '1';
      if (!alreadyPlayed) {
        localStorage.setItem(storageKey, '1');
      }
    } catch {
      // Ignore storage failures (e.g. private browsing restrictions)
    }

    animatedKeyRef.current = storageKey;
    if (alreadyPlayed) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setSrAnnouncement(t('home.streakGrew', { days: streakCurrent }));

    if (prefersReducedMotion) {
      setDisplayedStreak(streakCurrent);
      setIsAnimating(false);
      setShowPlusOne(true);
      const hideTimer = window.setTimeout(() => setShowPlusOne(false), 1200);
      return () => window.clearTimeout(hideTimer);
    }

    const fromVal =
      typeof streakBeforeToday === 'number' && streakBeforeToday < streakCurrent
        ? streakBeforeToday
        : Math.max(0, streakCurrent - 1);

    setDisplayedStreak(fromVal);
    setIsAnimating(true);
    setShowPlusOne(true);

    let rafId = 0;
    const durationMs = 360;
    const startTs = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(fromVal + (streakCurrent - fromVal) * eased);
      setDisplayedStreak(currentVal);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        setDisplayedStreak(streakCurrent);
      }
    };

    rafId = window.requestAnimationFrame(step);

    const endAnimTimer = window.setTimeout(() => {
      setIsAnimating(false);
    }, 420);
    const hidePlusTimer = window.setTimeout(() => {
      setShowPlusOne(false);
    }, 900);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(endAnimTimer);
      window.clearTimeout(hidePlusTimer);
    };
  }, [streakIncreasedToday, streakCurrent, streakBeforeToday, uid, date, t]);

  const showFreezeChip = typeof freezes === 'number' || weeklyShieldAvailable;
  const effectiveFreezes = Math.max(0, freezes ?? 0);

  const stripDays = useMemo(() => {
    if (!Array.isArray(weekStrip) || weekStrip.length !== 7) return null;
    return weekStrip.map((day, idx) => ({
      ...day,
      letter: getWeekdayShortLetter(day.date, idx, locale),
      fullName: getWeekdayFullName(day.date, locale),
    }));
  }, [weekStrip, locale]);

  if (streakCurrent <= 0 && !stripDays) {
    return null;
  }

  return (
    <section className="space-y-2" aria-label={t('home.weekStripLabel')}>
      <span className="sr-only" aria-live="polite" data-testid="home-streak-sr">
        {srAnnouncement}
      </span>

      <div className="flex items-center justify-between gap-2">
        {streakCurrent > 0 ? (
          <Chip
            tone="volt"
            data-testid="home-streak-chip"
            data-animating={isAnimating ? 'true' : 'false'}
            className="gap-1.5 px-3 py-1 font-bold"
          >
            <Flame
              size={16}
              weight="fill"
              className={`text-ron-strong shrink-0 ${isAnimating ? 'rd-streak-flame-bump' : ''}`}
              aria-hidden="true"
            />
            <span className="rd-tabular" data-testid="home-streak-count">
              {t('common.daysCount', { count: displayedStreak })}
            </span>
            {showPlusOne && (
              <span
                data-testid="home-streak-plus-one"
                aria-hidden="true"
                className="rd-streak-plus-one bg-ink text-volt ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none"
              >
                +1
              </span>
            )}
          </Chip>
        ) : (
          <span />
        )}

        {showFreezeChip &&
          (onOpenFreezeSheet ? (
            <button
              type="button"
              onClick={onOpenFreezeSheet}
              data-testid="home-freeze-chip"
              aria-label={`${t('profile.shieldsTitle')}: ${effectiveFreezes}`}
              className="border-border bg-surface text-ink rd-sticker-pressable inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold shadow-[0_2px_0_var(--rd-border)]"
            >
              <span aria-hidden="true">🧊</span>
              <span className="rd-tabular">{effectiveFreezes}</span>
            </button>
          ) : (
            <Chip tone="neutral" data-testid="home-freeze-chip" className="gap-1 px-2.5 py-1">
              <span aria-hidden="true">🧊</span>
              <span className="rd-tabular">{effectiveFreezes}</span>
            </Chip>
          ))}
      </div>

      {stripDays && (
        <div
          role="group"
          aria-label={t('home.weekStripLabel')}
          data-testid="home-week-strip"
          className="grid grid-cols-7 gap-1.5"
        >
          {stripDays.map((day) => {
            const isToday = day.date === date;
            let cellClasses =
              'flex min-h-[38px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-center';
            let statusLabel = '';
            let iconNode: React.ReactNode = null;

            switch (day.state) {
              case 'played':
                cellClasses += ` bg-volt text-ink border-2 border-border shadow-[0_2px_0_var(--rd-border)]${
                  isToday ? ' ring-2 ring-duel ring-offset-1 ring-offset-bg' : ''
                }`;
                statusLabel = t('home.dayPlayed', { day: day.fullName });
                iconNode = (
                  <Flame size={12} weight="fill" className="text-ron-strong" aria-hidden="true" />
                );
                break;
              case 'frozen':
                cellClasses +=
                  ' bg-duel/15 text-ink border-2 border-duel shadow-[0_2px_0_var(--rd-border)]';
                statusLabel = t('home.dayFrozen', { day: day.fullName });
                iconNode = (
                  <span aria-hidden="true" className="text-[11px] leading-none">
                    🧊
                  </span>
                );
                break;
              case 'missed':
                cellClasses +=
                  ' bg-ron/15 text-ron-strong border-2 border-ron-strong shadow-[0_2px_0_var(--rd-border)]';
                statusLabel = t('home.dayMissed', { day: day.fullName });
                iconNode = (
                  <X size={12} weight="bold" className="text-ron-strong" aria-hidden="true" />
                );
                break;
              case 'today':
                cellClasses +=
                  ' bg-surface text-ink border-2 border-border shadow-[0_2px_0_var(--rd-border)] ring-2 ring-volt';
                statusLabel = t('home.dayToday', { day: day.fullName });
                iconNode = (
                  <span aria-hidden="true" className="bg-ron-strong h-1.5 w-1.5 rounded-full" />
                );
                break;
              case 'upcoming':
              default:
                cellClasses +=
                  ' bg-surface-2/60 text-muted border-2 border-dashed border-border-subtle';
                statusLabel = t('home.dayUpcoming', { day: day.fullName });
                iconNode = <span aria-hidden="true" className="h-3" />;
                break;
            }

            return (
              <div
                key={day.date}
                data-testid={`week-day-${day.date}`}
                data-state={day.state}
                aria-label={statusLabel}
                title={statusLabel}
                className={cellClasses}
              >
                <span className="text-[10px] font-black leading-none">{day.letter}</span>
                <span className="flex h-3.5 items-center justify-center">{iconNode}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
