'use client';

import { GearSix, Moon, Sun } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { SplashScreen } from '@/components/SplashScreen';
import { Button, Wordmark } from '@/components/ui';
import { getLocalSession, saveLocalSession, type LocalSession } from '@/lib/session';

const LOCALES = ['en', 'es', 'pt', 'ro'] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<LocalSession | null>(null);

  useEffect(() => {
    const s = getLocalSession();
    setSession(s);
    document.documentElement.setAttribute('data-theme', s.theme);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const isPlayFocusMode = pathname.endsWith('/play');

  const toggleTheme = () => {
    if (!session) return;
    const nextTheme = session.theme === 'light' ? 'dark' : 'light';
    const next = { ...session, theme: nextTheme } as LocalSession;
    saveLocalSession(next);
    setSession(next);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const setConsent = (analyticsConsent: 'accepted' | 'rejected') => {
    if (!session) return;
    const next = { ...session, analyticsConsent };
    saveLocalSession(next);
    setSession(next);
  };

  const switchLocale = (nextLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = nextLocale;
    router.push(segments.join('/') || `/${nextLocale}`);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SplashScreen />
      {!isPlayFocusMode && (
        <header className="border-border-subtle bg-surface/80 border-b backdrop-blur">
          <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
            <Link
              href={`/${locale}`}
              aria-label="RonDuel home"
              className="inline-flex items-center"
            >
              <Wordmark size="sm" />
            </Link>

            <div className="flex items-center gap-1.5">
              <Link
                href={`/${locale}/pro`}
                className="border-border bg-volt inline-flex h-11 items-center justify-center rounded-[10px] border px-2.5 text-xs font-extrabold text-[#16131F]"
              >
                {t('nav.pro')}
              </Link>

              <Link
                href={`/${locale}/me`}
                className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 items-center justify-center rounded-[10px] border px-2.5 text-xs font-bold"
              >
                {t('nav.profile')}
              </Link>

              <label htmlFor="locale-select" className="sr-only">
                {t('settings.language')}
              </label>
              <select
                id="locale-select"
                value={locale}
                onChange={(e) => switchLocale(e.target.value)}
                className="border-border-subtle bg-surface-2 text-ink min-h-11 rounded-[10px] border px-2 text-xs font-bold uppercase"
              >
                {LOCALES.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc.toUpperCase()}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border"
              >
                {session?.theme === 'dark' ? (
                  <Sun size={18} weight="bold" aria-hidden="true" />
                ) : (
                  <Moon size={18} weight="bold" aria-hidden="true" />
                )}
              </button>

              <Link
                href={`/${locale}/settings`}
                aria-label={t('nav.settings')}
                className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 items-center justify-center rounded-[10px] border"
              >
                <GearSix size={18} weight="bold" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className="flex-1">{children}</div>

      {!isPlayFocusMode && (
        <footer
          className={`text-muted mx-auto flex w-full max-w-[480px] flex-wrap items-center justify-center gap-4 px-4 pt-6 text-xs ${
            session?.analyticsConsent === 'unset' ? 'pb-32' : 'pb-6'
          }`}
        >
          <Link href={`/${locale}/legal/terms`} className="underline">
            {t('legal.footerTerms')}
          </Link>
          <Link href={`/${locale}/legal/privacy`} className="underline">
            {t('legal.footerPrivacy')}
          </Link>
          <Link href={`/${locale}/legal/cookies`} className="underline">
            {t('legal.footerCookies')}
          </Link>
          <Link href={`/${locale}/legal/imprint`} className="underline">
            {t('legal.footerImprint')}
          </Link>
        </footer>
      )}

      {session?.analyticsConsent === 'unset' && !isPlayFocusMode && (
        <aside
          aria-label="Cookie and analytics consent"
          className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t-2 p-4 shadow-[var(--rd-shadow-sheet)]"
        >
          <div className="mx-auto flex max-w-[480px] flex-col gap-3">
            <p className="text-ink text-xs">{t('consent.message')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConsent('rejected')}>
                {t('consent.reject')}
              </Button>
              <Button size="sm" variant="blue" onClick={() => setConsent('accepted')}>
                {t('consent.accept')}
              </Button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
