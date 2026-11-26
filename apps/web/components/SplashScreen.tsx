'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Chip, Wordmark } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

export interface SplashRoundStatus {
  roundNumber: number;
  themeKey?: string;
  topicOfTheDay?: string;
  played: boolean;
  playId?: string;
  streakCurrent: number;
  isAnonymous?: boolean;
}

const SPLASH_SESSION_KEY = 'ronduel_splash_seen_v2';
const READY_CAP_MS = 600;
const HOLD_VISIBLE_MS = 1000;
const HARD_CAP_MS = 1600;
const FADE_OUT_MS = 250;

const THEME_KEYS: Record<string, { emoji: string; key: string }> = {
  worldScience: { emoji: '🌍', key: 'worldScience' },
  historyLogic: { emoji: '⏳', key: 'historyLogic' },
  numbersNature: { emoji: '🔢', key: 'numbersNature' },
  cultureMind: { emoji: '🎨', key: 'cultureMind' },
  speedSpace: { emoji: '🚀', key: 'speedSpace' },
};

export function parseTopicChip(
  rawTopic: string,
  translateTheme: (key: string) => string,
): { emoji: string; name: string } {
  if (rawTopic in THEME_KEYS) {
    const item = THEME_KEYS[rawTopic]!;
    return {
      emoji: item.emoji,
      name: translateTheme(item.key),
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
    name: translateTheme('worldScience'),
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

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SplashScreen() {
  const t = useTranslations('splash');
  const tRoot = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();

  const [reducedMotion, setReducedMotion] = useState<boolean>(getPrefersReducedMotion);
  const [logoVisible, setLogoVisible] = useState<boolean>(getPrefersReducedMotion);
  const [detailsVisible, setDetailsVisible] = useState<boolean>(getPrefersReducedMotion);
  const [pulseActive, setPulseActive] = useState(false);
  const [fading, setFading] = useState(false);
  const [unmounted, setUnmounted] = useState(
    () => pathname !== `/${locale}` && pathname !== `/${locale}/`,
  );
  const [status, setStatus] = useState<SplashRoundStatus | null>(null);

  const logoWrapRef = useRef<HTMLDivElement | null>(null);
  const dismissedRef = useRef(false);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const timersRef = useRef<number[]>([]);

  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const dismissSplash = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    clearAllTimers();

    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {
      // ignore storage errors
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ronduel_splash_dismissed'));
    }

    if (reducedMotionRef.current) {
      setUnmounted(true);
      return;
    }

    setFading(true);
    const unmountId = window.setTimeout(() => {
      setUnmounted(true);
    }, FADE_OUT_MS);
    timersRef.current.push(unmountId);
  }, [clearAllTimers]);

  useEffect(() => {
    const isHomeRoute = pathname === `/${locale}` || pathname === `/${locale}/`;
    if (!isHomeRoute) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ronduel_splash_dismissed'));
      }
      setUnmounted(true);
      return;
    }

    // Show once per browser session
    try {
      if (window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ronduel_splash_dismissed'));
        }
        setUnmounted(true);
        return;
      }
    } catch {
      // ignore storage errors
    }

    const isReduced = getPrefersReducedMotion();
    setReducedMotion(isReduced);
    reducedMotionRef.current = isReduced;

    const session = getLocalSession();
    const tz = getBrowserTimeZone();
    const isReturningAuth = Boolean(
      !session.isAnonymous ||
      session.email ||
      (session.authProvider && session.authProvider !== 'anonymous'),
    );

    trackEvent('splash_shown', { returning: isReturningAuth, locale });

    let cancelled = false;
    let holdStarted = false;

    const startHoldAndEntrance = () => {
      if (cancelled || dismissedRef.current || holdStarted) return;
      holdStarted = true;

      if (isReduced) {
        setLogoVisible(true);
        setDetailsVisible(true);
        setPulseActive(false);
      } else {
        setLogoVisible(true);
        const detailsId = window.setTimeout(() => {
          if (!cancelled) setDetailsVisible(true);
        }, 120);
        const pulseId = window.setTimeout(() => {
          if (!cancelled) setPulseActive(true);
        }, 300);
        timersRef.current.push(detailsId, pulseId);
      }

      const holdId = window.setTimeout(() => {
        if (!cancelled) dismissSplash();
      }, HOLD_VISIBLE_MS);
      timersRef.current.push(holdId);
    };

    // Wait for fonts + logo image decode, capped at 600ms
    const fontsReady: Promise<void> =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready.then(() => undefined).catch(() => undefined)
        : Promise.resolve();

    const logoImg = logoWrapRef.current?.querySelector('img') ?? null;
    const logoReady: Promise<void> = !logoImg
      ? Promise.resolve()
      : logoImg.complete && logoImg.naturalWidth > 0
        ? typeof logoImg.decode === 'function'
          ? logoImg.decode().catch(() => undefined)
          : Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => {
              logoImg.removeEventListener('load', done);
              logoImg.removeEventListener('error', done);
              resolve();
            };
            logoImg.addEventListener('load', done, { once: true });
            logoImg.addEventListener('error', done, { once: true });
          });

    const readyCapId = window.setTimeout(startHoldAndEntrance, READY_CAP_MS);
    const hardCapId = window.setTimeout(dismissSplash, HARD_CAP_MS);
    timersRef.current.push(readyCapId, hardCapId);

    void Promise.all([fontsReady, logoReady]).then(() => {
      startHoldAndEntrance();
    });

    // Skip immediately on Escape or Enter
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        dismissSplash();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Fetch round/streak metadata without redirecting on played
    fetch(`/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data: SplashRoundStatus) => {
        if (cancelled) return;
        setStatus({
          roundNumber: data.roundNumber ?? 1,
          themeKey: data.themeKey ?? 'worldScience',
          topicOfTheDay: data.topicOfTheDay ?? '',
          played: Boolean(data.played),
          playId: data.playId,
          streakCurrent: data.streakCurrent ?? 0,
          isAnonymous: data.isAnonymous,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      clearAllTimers();
    };
  }, [locale, pathname, dismissSplash, clearAllTimers]);

  if (unmounted) {
    return null;
  }

  const { emoji, name: themeName } = parseTopicChip(
    status?.themeKey || status?.topicOfTheDay || 'worldScience',
    (key) => {
      try {
        return tRoot(`themes.${key}` as Parameters<typeof tRoot>[0]);
      } catch {
        return key;
      }
    },
  );

  const roundChipText = status
    ? t('roundChip', {
        number: status.roundNumber,
        emoji,
        theme: themeName,
      })
    : '';

  const taglineText = status?.played
    ? t('comeBackTomorrow', { nextRound: status.roundNumber + 1 })
    : t('tagline');

  const streakText =
    status && status.streakCurrent > 0
      ? formatStreakSplash(status.streakCurrent, {
          streakOne: t('streakOne'),
          streakMany: (days) => t('streakMany', { days }),
        })
      : null;

  return (
    <div
      data-testid="pwa-splash"
      role="status"
      aria-live="polite"
      aria-label={tRoot('a11y.splash')}
      onClick={dismissSplash}
      className={cn(
        !reducedMotion && 'rd-splash-overlay',
        'bg-bg text-ink fixed inset-0 z-50 flex select-none flex-col items-center justify-center px-6 text-center',
        fading ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex w-full max-w-[360px] flex-col items-center">
        {/* Decorative logo with 300ms opacity+scale entrance, subtle pulse only after entrance */}
        <div
          ref={logoWrapRef}
          aria-hidden="true"
          className={
            reducedMotion
              ? 'opacity-100'
              : cn(
                  'transition-[opacity,transform] duration-300 ease-out',
                  logoVisible ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0',
                )
          }
        >
          <div
            className={cn(
              pulseActive && !reducedMotion && 'rd-splash-logo',
              'flex flex-col items-center gap-2',
            )}
          >
            <Wordmark size="lg" />
          </div>
        </div>

        {/* Tagline & fixed-height chip slot (zero CLS when status arrives) */}
        <div
          className={
            reducedMotion
              ? 'mt-4 flex flex-col items-center gap-2.5 opacity-100'
              : `mt-4 flex flex-col items-center gap-2.5 transition-[opacity,transform] duration-[250ms] ease-out ${
                  detailsVisible ? 'translate-y-0 opacity-100' : 'translate-y-[6px] opacity-0'
                }`
          }
        >
          <p data-testid="splash-tagline" className="text-muted text-base font-medium">
            {taglineText}
          </p>

          <div className="flex min-h-[72px] flex-col items-center gap-2">
            <Chip
              data-testid="splash-round-chip"
              tone="volt"
              style={{ visibility: status ? 'visible' : 'hidden' }}
              className="px-3 py-1.5 text-xs font-extrabold"
            >
              {status ? roundChipText : '\u00A0'}
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
      </div>
    </div>
  );
}
