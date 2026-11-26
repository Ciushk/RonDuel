'use client';

import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { usePro } from './ProProvider';

const RonBotMascot = dynamic(
  () => import('@/components/RonBotMascot').then((m) => m.RonBotMascot),
  { ssr: false },
);

/**
 * Returns true on routes where RonBot must not mount or download its client chunk.
 * Uses path-segment boundaries so e.g. `/en/town` and `/en/town/...` match across all
 * locales without matching `/en/townhall`.
 */
export function shouldHideRonBot(pathname: string | null | undefined, locale?: string): boolean {
  if (!pathname) return true;

  if (locale) {
    const townPrefix = `/${locale}/town`;
    if (pathname === townPrefix || pathname.startsWith(`${townPrefix}/`)) {
      return true;
    }
  }

  return (
    /^\/[a-z]{2}(?:-[a-z]{2})?\/town(?:\/|$)/i.test(pathname) ||
    /(?:^|\/)play(?:\/|$)/.test(pathname) ||
    /(?:^|\/)admin(?:\/|$)/.test(pathname)
  );
}

/**
 * Combined client visibility predicate: RonBot may only load and mount on allowed routes
 * when Pro status has finished loading and is active (`isPro === true`).
 */
export function canShowRonBot(params: {
  pathname: string | null | undefined;
  locale?: string;
  isPro: boolean;
  loading: boolean;
}): boolean {
  if (shouldHideRonBot(params.pathname, params.locale)) return false;
  if (params.loading || !params.isPro) return false;
  return true;
}

/**
 * Defers loading and mounting the floating RonBot mascot chunk until after initial hydration
 * so it never blocks first paint or Lighthouse TBT on mobile, and skips loading completely
 * for non-Pro users or on hidden routes (RonTown, Play focus mode, Admin).
 */
export function DeferredRonBot() {
  const pathname = usePathname();
  const locale = useLocale();
  const { isPro, loading } = usePro();
  const allowed = canShowRonBot({ pathname, locale, isPro, loading });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!allowed) {
      setReady(false);
      return;
    }

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => setReady(true), { timeout: 1200 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(id);
  }, [allowed]);

  if (!allowed || !ready) return null;

  return <RonBotMascot />;
}
