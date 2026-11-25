'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CreateLeagueWizard } from '@/components/CreateLeagueWizard';
import { JoinByCodeDialog } from '@/components/JoinByCodeDialog';
import { Button, Chip, Wordmark } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
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

export function SplashScreen() {
  const t = useTranslations('splash');
  const tRoot = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fading, setFading] = useState(false);
  const [unmounted, setUnmounted] = useState(
    () => pathname !== `/${locale}` && pathname !== `/${locale}/`,
  );
  const [isSignedInUser, setIsSignedInUser] = useState(false);
  const [status, setStatus] = useState<SplashRoundStatus>({
    roundNumber: 1,
    themeKey: 'worldScience',
    played: false,
    streakCurrent: 0,
  });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const isHomeRoute = pathname === `/${locale}` || pathname === `/${locale}/`;
    if (!isHomeRoute) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ronduel_splash_dismissed'));
      }
      setUnmounted(true);
      return;
    }

    // Only show once per session
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

    const session = getLocalSession();
    const tz = getBrowserTimeZone();
    const isReturningAuth = Boolean(
      !session.isAnonymous ||
      session.email ||
      (session.authProvider && session.authProvider !== 'anonymous'),
    );
    setIsSignedInUser(isReturningAuth);

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    trackEvent('splash_shown', { returning: isReturningAuth, locale });

    const dismissSplash = () => {
      try {
        window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ronduel_splash_dismissed'));
      }
      setFading(true);
      window.setTimeout(() => {
        setUnmounted(true);
      }, 220);
    };

    if (isReturningAuth) {
      // Signed in with Google/email: short splash (logo only, max 0.8s) then home hub
      const timer = window.setTimeout(dismissSplash, 750);
      timersRef.current.push(timer);
    } else if (prefersReducedMotion) {
      // Reduced motion: jump straight to step 3, under 1.8s
      setStep(3);
      const timer = window.setTimeout(dismissSplash, 950);
      timersRef.current.push(timer);
    } else {
      // Animated 3-step splash:
      // Step 1: ~450ms logo centered
      // Step 2: ~400ms logo slides up, tagline fades in
      // Step 3: buttons slide in
      // Total under 1.8s: transitions to home hub unless CTA clicked
      const t1 = window.setTimeout(() => setStep(2), 450);
      const t2 = window.setTimeout(() => setStep(3), 850);
      const t3 = window.setTimeout(dismissSplash, 1150);
      timersRef.current.push(t1, t2, t3);
    }

    fetch(`/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data: SplashRoundStatus) => {
        setStatus({
          roundNumber: data.roundNumber ?? 1,
          themeKey: (data as any).themeKey ?? 'worldScience',
          topicOfTheDay: data.topicOfTheDay ?? '',
          played: Boolean(data.played),
          playId: data.playId,
          streakCurrent: data.streakCurrent ?? 0,
          isAnonymous: data.isAnonymous,
        });

        const isHomeRoute =
          (typeof window !== 'undefined' &&
            (window.location.pathname === `/${locale}` ||
              window.location.pathname === `/${locale}/`)) ||
          pathname === `/${locale}` ||
          pathname === `/${locale}/`;
        if (data.played && data.playId && isHomeRoute) {
          router.replace(`/${locale}/result/${encodeURIComponent(data.playId)}`);
          if (typeof window !== 'undefined') {
            window.location.href = `/${locale}/result/${encodeURIComponent(data.playId)}`;
          }
          dismissSplash();
        }
      })
      .catch(() => {});

    return () => {
      timersRef.current.forEach((tId) => window.clearTimeout(tId));
    };
  }, [locale, pathname, router]);

  if (unmounted) {
    return (
      <>
        <CreateLeagueWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreated={(lg) => router.push(`/${locale}/league/${lg.id ?? lg.leagueId}`)}
        />
        <JoinByCodeDialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)} />
      </>
    );
  }

  const handleTapAnywhere = () => {
    if (step < 3 && !isSignedInUser) {
      setStep(3);
    } else {
      try {
        window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ronduel_splash_dismissed'));
      }
      setFading(true);
      setTimeout(() => setUnmounted(true), 200);
    }
  };

  const handleCreateLeague = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ronduel_splash_dismissed'));
    }
    trackEvent('splash_cta_clicked', { cta: 'create' });
    setFading(true);
    setTimeout(() => {
      setUnmounted(true);
      setWizardOpen(true);
    }, 180);
  };

  const handleJoinLeague = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ronduel_splash_dismissed'));
    }
    trackEvent('splash_cta_clicked', { cta: 'join' });
    setFading(true);
    setTimeout(() => {
      setUnmounted(true);
      setJoinDialogOpen(true);
    }, 180);
  };

  const handlePlayPublic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ronduel_splash_dismissed'));
    }
    trackEvent('splash_cta_clicked', { cta: 'play_public' });
    setFading(true);

    const s = getLocalSession();
    // Silently ensure user joins public world league
    fetch('/api/leagues/WORLD1/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: s.uid,
        nickname: s.nickname || `Player_${s.uid.slice(-3)}`,
        tz: getBrowserTimeZone(),
      }),
    }).catch(() => {});

    setTimeout(() => {
      setUnmounted(true);
      router.push(`/${locale}/play`);
    }, 180);
  };

  const { emoji, name: themeName } = parseTopicChip(
    status.themeKey || status.topicOfTheDay || 'worldScience',
    (key) => {
      try {
        return tRoot(`themes.${key}` as Parameters<typeof tRoot>[0]);
      } catch {
        return key;
      }
    },
  );

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
    <>
      <div
        data-testid="pwa-splash"
        role="dialog"
        aria-modal="true"
        aria-label="RonDuel"
        onClick={handleTapAnywhere}
        className={`rd-splash-overlay bg-bg text-ink fixed inset-0 z-50 flex select-none flex-col items-center justify-center px-6 text-center ${
          fading ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div className="flex w-full max-w-[360px] flex-col items-center">
          {/* Logo container with vertical slide transition */}
          <div
            className={`transition-transform duration-500 ease-out ${
              isSignedInUser
                ? 'translate-y-0 scale-100'
                : step === 1
                  ? 'translate-y-0 scale-95'
                  : '-translate-y-6 scale-100 sm:-translate-y-8'
            }`}
          >
            <div className="rd-splash-logo flex flex-col items-center gap-2">
              <Wordmark size="lg" />
            </div>
          </div>

          {/* Tagline & round chip (Step 2 & 3 or signed in) */}
          <div
            className={`duration-400 mt-4 flex flex-col items-center gap-2.5 transition-all ease-out ${
              isSignedInUser
                ? 'translate-y-0 opacity-100'
                : step >= 2
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-2 opacity-0'
            }`}
          >
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

          {/* Staggered buttons in Step 3 for new/anonymous users */}
          {!isSignedInUser && (
            <div
              className={`duration-400 mt-8 flex w-full flex-col items-stretch gap-3 transition-all ease-out ${
                step === 3
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-6 opacity-0'
              }`}
            >
              <Button
                size="lg"
                variant="primary"
                fullWidth
                onClick={handleCreateLeague}
                className="shadow-[var(--rd-shadow-button)]"
              >
                {t('createLeague')}
              </Button>

              <Button size="lg" variant="secondary" fullWidth onClick={handleJoinLeague}>
                {t('joinLeague')}
              </Button>

              <button
                type="button"
                onClick={handlePlayPublic}
                className="text-muted hover:text-ink mt-1 cursor-pointer py-1.5 text-xs font-bold underline underline-offset-4"
              >
                {t('playWithoutLeague')}
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateLeagueWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(lg) => router.push(`/${locale}/league/${lg.id ?? lg.leagueId}`)}
      />
      <JoinByCodeDialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)} />
    </>
  );
}
