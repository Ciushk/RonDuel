'use client';

import { ArrowLeft, Moon, Sun, X } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { BottomNav } from '@/components/BottomNav';
import { LanguageSelector } from '@/components/LanguageSelector';
import { PaymentAuthGateProvider } from '@/components/PaymentAuthGate';
import { PwaUpdateToast } from '@/components/PwaUpdateToast';
import { Button, Wordmark } from '@/components/ui';
import { syncAnalyticsConsent, trackEvent } from '@/lib/analytics';
import { useBottomStack } from '@/lib/bottom-stack';
import { initInstallPromptCapture } from '@/lib/install-prompt';
import { getLocalSession, saveLocalSession, type LocalSession } from '@/lib/session';

const SplashScreen = dynamic(
  () => import('@/components/SplashScreen').then((m) => m.SplashScreen),
  { ssr: false },
);

const AuthModal = dynamic(() => import('@/components/AuthModal').then((m) => m.AuthModal), {
  ssr: false,
});

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<LocalSession | null>(null);
  const [sessionExpiredToast, setSessionExpiredToast] = useState(false);
  const [expiredAuthOpen, setExpiredAuthOpen] = useState(false);
  const consentRef = useRef<HTMLElement>(null);
  const showConsent = session?.analyticsConsent === 'unset' && !pathname.endsWith('/play');
  useBottomStack('consent-banner', consentRef, Boolean(showConsent));

  useEffect(() => {
    initInstallPromptCapture();
    const s = getLocalSession();
    setSession(s);
    syncAnalyticsConsent();
    document.documentElement.setAttribute('data-theme', s.theme);
    document.documentElement.classList.toggle('dark', s.theme === 'dark');

    let cancelled = false;
    let stopTracker: (() => void) | null = null;

    void import('@/lib/session-activity').then(
      ({ ensureInactivityCheckOnce, startActivityTracker }) => {
        if (cancelled) return;
        void ensureInactivityCheckOnce().then(({ expired }) => {
          if (cancelled) return;
          if (expired) {
            setSession(getLocalSession());
            setSessionExpiredToast(true);
          }
        });
        stopTracker = startActivityTracker();
      },
    );

    return () => {
      cancelled = true;
      stopTracker?.();
    };
  }, []);

  const isPlayFocusMode = pathname.endsWith('/play');
  const isLeaguePreview = pathname.includes('/l/');
  const isAdmin =
    pathname.startsWith('/admin') || (pathname.includes('/league/') && pathname.endsWith('/admin'));
  const isCheckoutReturn = pathname.includes('/billing/return');

  const hideBottomNav = isPlayFocusMode || isLeaguePreview || isAdmin || isCheckoutReturn;

  const isHomeRoute = pathname === `/${locale}` || pathname === `/${locale}/`;
  const isTownRoute = pathname === `/${locale}/town`;

  const isTopLevelPage =
    isHomeRoute ||
    pathname === `/${locale}/leagues` ||
    isTownRoute ||
    pathname === `/${locale}/duels` ||
    pathname === `/${locale}/me` ||
    pathname === '/';

  const showBackArrow = !isTopLevelPage && !isPlayFocusMode && !isLeaguePreview;

  const toggleTheme = () => {
    if (!session) return;
    const nextTheme = session.theme === 'light' ? 'dark' : 'light';
    trackEvent('theme_toggled', { to: nextTheme });
    const next = { ...session, theme: nextTheme } as LocalSession;
    saveLocalSession(next);
    setSession(next);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const setConsent = (analyticsConsent: 'accepted' | 'rejected') => {
    if (!session) return;
    const next = { ...session, analyticsConsent };
    saveLocalSession(next);
    setSession(next);
    syncAnalyticsConsent();
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${locale}`);
    }
  };

  return (
    <PaymentAuthGateProvider>
      <div
        className={`bg-bg text-ink flex flex-col ${
          isTownRoute ? 'h-dvh overflow-hidden overscroll-none' : 'min-h-dvh'
        }`}
      >
        {isHomeRoute && <SplashScreen />}

        {/* A. Clean Header */}
        {!isPlayFocusMode && (
          <header className="border-border bg-surface/95 sticky top-0 z-30 shrink-0 border-b-2 pt-[env(safe-area-inset-top)] backdrop-blur-md">
            <div className="flex h-14 w-full items-center justify-between px-4">
              {/* Left: Back button (if sub-page) + Logo mark (28px) & Wordmark */}
              <div className="flex items-center gap-2">
                {showBackArrow && (
                  <button
                    type="button"
                    onClick={handleBack}
                    aria-label={t('a11y.previousPage')}
                    className="border-border bg-surface-2 text-ink hover:bg-surface inline-flex h-10 w-10 shrink-0 cursor-pointer select-none items-center justify-center rounded-[10px] border-2 shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    <ArrowLeft size={18} weight="bold" />
                  </button>
                )}
                <Link
                  href={`/${locale}`}
                  prefetch={false}
                  aria-label={t('a11y.homeLink')}
                  className="inline-flex select-none items-center"
                >
                  <Wordmark size="sm" iconSize={28} />
                </Link>
              </div>

              {/* Right: ONLY the language selector and the theme toggle (8px gap) */}
              <div className="flex items-center gap-2">
                <LanguageSelector source="header" />

                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={t('a11y.toggleTheme')}
                  className="border-border bg-surface-2 text-ink hover:bg-surface inline-flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-[10px] border-2 shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  {session?.theme === 'dark' ? (
                    <Sun size={18} weight="bold" aria-hidden="true" />
                  ) : (
                    <Moon size={18} weight="bold" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Main Content Area with Desktop Sidebar */}
        <div className={`flex w-full flex-1 ${isTownRoute ? 'min-h-0 overflow-hidden' : ''}`}>
          {!hideBottomNav && <BottomNav desktopSidebar />}

          <div
            className={`min-w-0 flex-1 ${
              isTownRoute
                ? 'h-full min-h-0 overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:pl-60'
                : hideBottomNav
                  ? ''
                  : 'pb-24 lg:pb-8 lg:pl-60'
            }`}
          >
            {children}
          </div>
        </div>

        {/* B. Bottom Navigation Bar on Mobile */}
        {!hideBottomNav && <BottomNav />}

        {/* Footer (links) */}
        {!isPlayFocusMode && !isTownRoute && (
          <footer
            className={`text-muted mx-auto flex w-full max-w-[480px] flex-wrap items-center justify-center gap-4 px-4 pt-6 text-xs ${
              !hideBottomNav ? 'lg:pl-60' : ''
            } ${
              session?.analyticsConsent === 'unset'
                ? 'pb-36 lg:pb-24'
                : hideBottomNav
                  ? 'pb-6'
                  : 'pb-24 lg:pb-6'
            }`}
          >
            <Link href={`/${locale}/legal/terms`} prefetch={false} className="underline">
              {t('legal.footerTerms')}
            </Link>
            <Link href={`/${locale}/regulament`} prefetch={false} className="underline">
              {t('rules.footerLink')}
            </Link>
            <Link href={`/${locale}/legal/privacy`} prefetch={false} className="underline">
              {t('legal.footerPrivacy')}
            </Link>
            <Link href={`/${locale}/legal/cookies`} prefetch={false} className="underline">
              {t('legal.footerCookies')}
            </Link>
            <Link href={`/${locale}/legal/imprint`} prefetch={false} className="underline">
              {t('legal.footerImprint')}
            </Link>
          </footer>
        )}

        {/* Cookie / Analytics Consent Banner */}
        {session?.analyticsConsent === 'unset' && !isPlayFocusMode && (
          <aside
            ref={consentRef}
            aria-label={t('consent.ariaLabel')}
            className="border-border bg-surface fixed inset-x-0 bottom-16 z-40 max-h-[80px] border-t-2 px-4 py-2.5 shadow-[var(--rd-shadow-sheet)] lg:bottom-0"
          >
            <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3">
              <p className="text-ink line-clamp-2 flex-1 text-xs leading-snug">
                {t('consent.message')}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-9 px-3 text-xs"
                  onClick={() => setConsent('rejected')}
                >
                  {t('consent.reject')}
                </Button>
                <Button
                  size="sm"
                  variant="blue"
                  className="min-h-9 px-3 text-xs"
                  onClick={() => setConsent('accepted')}
                >
                  {t('consent.accept')}
                </Button>
              </div>
            </div>
          </aside>
        )}

        {/* 30-day inactivity expiry toast with Sign-in action */}
        {sessionExpiredToast && (
          <div
            role="status"
            aria-live="polite"
            data-testid="session-expired-toast"
            className="border-border bg-surface text-ink fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-[440px] items-center justify-between gap-3 rounded-[16px] border-2 px-4 py-3 text-xs font-bold shadow-[var(--rd-shadow-sheet)] lg:bottom-6"
          >
            <span className="min-w-0 leading-snug">{t('session.expired')}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="volt"
                className="min-h-11 px-3 text-xs font-black"
                onClick={() => {
                  setSessionExpiredToast(false);
                  setExpiredAuthOpen(true);
                }}
              >
                {t('session.signIn')}
              </Button>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => setSessionExpiredToast(false)}
                className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border"
              >
                <X size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {expiredAuthOpen && (
          <AuthModal
            open={expiredAuthOpen}
            onClose={() => setExpiredAuthOpen(false)}
            initialMode="login"
            onSuccess={() => {
              setSession(getLocalSession());
              setExpiredAuthOpen(false);
            }}
          />
        )}

        {/* PWA update toast (registers /sw.js?v=2 and prompts for new builds) */}
        <PwaUpdateToast hasConsentBanner={Boolean(showConsent)} hideBottomNav={hideBottomNav} />
      </div>
    </PaymentAuthGateProvider>
  );
}
