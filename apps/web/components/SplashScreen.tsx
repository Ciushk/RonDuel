'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Chip, Wordmark } from '@/components/ui';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

export interface SplashRoundStatus {
  roundNumber: number;
  topicOfTheDay: string;
  played: boolean;
  playId?: string;
  streakCurrent: number;
}

const SPLASH_SESSION_KEY = 'ronduel_splash_shown_v1';

const TOPIC_MAP: Record<string, { emoji: string; key: string }> = {
  'World & Science 🌍': { emoji: '🌍', key: 'World & Science' },
  'History & Logic ⏳': { emoji: '⏳', key: 'History & Logic' },
  'Numbers & Nature 🔢': { emoji: '🔢', key: 'Numbers & Nature' },
  'Culture & Mind 🎨': { emoji: '🎨', key: 'Culture & Mind' },
  'Speed & Space 🚀': { emoji: '🚀', key: 'Speed & Space' },
};

export function parseTopicChip(
  rawTopic: string,
  translateTheme: (key: string) => string,
): { emoji: string; name: string } {
  const mapped = TOPIC_MAP[rawTopic];
  if (mapped) {
    return {
      emoji: mapped.emoji,
      name: translateTheme(mapped.key),
    };
  }
  const parts = rawTopic.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '🌍';
  const hasTrailingEmoji = /[^\w\s&]/u.test(last);
  if (hasTrailingEmoji && parts.length > 1) {
    const nameKey = parts.slice(0, -1).join(' ');
    return {
      emoji: last,
      name: translateTheme(nameKey),
    };
  }
  return {
    emoji: '🌍',
    name: rawTopic,
  };
}

export function formatStreakSplash(
  days: number,
  t: {
    streakOne: string;
    streakMany: (days: number) => string;
  },
): string {
  if (days === 1) {
    return t.streakOne;
  }
  return t.streakMany(days);
}

export function SplashScreen() {
  const t = useTranslations('splash');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [status, setStatus] = useState<SplashRoundStatus>({
    roundNumber: 1,
    topicOfTheDay: 'World & Science 🌍',
    played: false,
    streakCurrent: 0,
  });
  const [fading, setFading] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    // Only show once per tab session on first page load / PWA launch
    try {
      if (window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1') {
        setFading(true);
        setUnmounted(true);
        return;
      }
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {
      // ignore storage errors
    }

    let cancelled = false;
    const session = getLocalSession();
    const tz = getBrowserTimeZone();

    const startFadeOut = () => {
      if (cancelled) return;
      setFading(true);
      window.setTimeout(() => {
        if (!cancelled) setUnmounted(true);
      }, 220);
    };

    // Hard cap: max ~1.2s total splash duration
    const maxTimer = window.setTimeout(startFadeOut, 950);

    fetch(`/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data: SplashRoundStatus) => {
        if (cancelled) return;
        setStatus({
          roundNumber: data.roundNumber ?? 1,
          topicOfTheDay: data.topicOfTheDay ?? 'World & Science 🌍',
          played: Boolean(data.played),
          playId: data.playId,
          streakCurrent: data.streakCurrent ?? 0,
        });

        const isHomeRoute = pathname === `/${locale}` || pathname === `/${locale}/`;
        if (data.played && data.playId && isHomeRoute) {
          router.replace(`/${locale}/result/${encodeURIComponent(data.playId)}`);
        }

        // Fade out promptly once hydrated and status is ready (never block when app is ready)
        window.setTimeout(startFadeOut, 180);
      })
      .catch(() => {
        if (!cancelled) startFadeOut();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(maxTimer);
    };
  }, [locale, pathname, router]);

  if (unmounted) return null;

  const { emoji, name: themeName } = parseTopicChip(status.topicOfTheDay, (key) => {
    try {
      return t(`themes.${key}` as Parameters<typeof t>[0]);
    } catch {
      return key;
    }
  });

  const roundChipText = t('roundChip', {
    number: status.roundNumber,
    emoji,
    theme: themeName,
  });

  const taglineText = status.played
    ? t('comeBackTomorrow', { nextRound: status.roundNumber + 1 })
    : t('tagline');

  const streakText =
    status.streakCurrent > 0
      ? formatStreakSplash(status.streakCurrent, {
          streakOne: t('streakOne'),
          streakMany: (days) => t('streakMany', { days }),
        })
      : null;

  return (
    <div
      data-testid="pwa-splash"
      aria-hidden="true"
      className={`rd-splash-overlay bg-bg text-ink pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex max-w-[360px] flex-col items-center gap-3.5">
        <div className="rd-seam h-2 w-24 rounded-full" />

        <div className="rd-splash-logo flex flex-col items-center gap-2">
          <Wordmark size="lg" />
        </div>

        <p data-testid="splash-tagline" className="text-muted text-base font-medium">
          {taglineText}
        </p>

        <Chip
          data-testid="splash-round-chip"
          tone="volt"
          className="px-3 py-1.5 text-xs font-extrabold"
        >
          {roundChipText}
        </Chip>

        {streakText && (
          <Chip
            data-testid="splash-streak-chip"
            tone="gold"
            className="px-3 py-1 text-xs font-extrabold"
          >
            {streakText}
          </Chip>
        )}
      </div>
    </div>
  );
}
