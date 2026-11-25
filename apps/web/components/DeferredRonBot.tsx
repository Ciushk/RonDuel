'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const RonBotMascot = dynamic(
  () => import('@/components/RonBotMascot').then((m) => m.RonBotMascot),
  { ssr: false },
);

/**
 * Defers loading and mounting the floating RonBot mascot chunk until after initial hydration
 * so it never blocks first paint or Lighthouse TBT on mobile.
 */
export function DeferredRonBot() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, []);

  return ready ? <RonBotMascot /> : null;
}
