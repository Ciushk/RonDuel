// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const base = namespace
      ? (enMessages as Record<string, unknown>)[namespace]
      : (enMessages as Record<string, unknown>);
    return (key: string, values?: Record<string, string | number>) => {
      const parts = key.split('.');
      let cur: unknown = base;
      for (const p of parts) {
        cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
      }
      let out = typeof cur === 'string' ? cur : key;
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          out = out.replaceAll(`{${k}}`, String(v));
        }
      }
      return out;
    };
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/en',
  useRouter: () => ({
    replace: mockRouterReplace,
    push: mockRouterPush,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { SplashScreen } from '@/components/SplashScreen';

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: reducedMotion,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe('SplashScreen (Part C)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();
    mockMatchMedia(false);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        roundNumber: 42,
        themeKey: 'worldScience',
        played: false,
        streakCurrent: 3,
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('renders zero buttons, hides Round #1 before status resolves, and dismisses within 1600ms', async () => {
    let resolveStatus!: (val: unknown) => void;
    globalThis.fetch = vi.fn().mockReturnValue(
      new Promise((res) => {
        resolveStatus = res;
      }),
    ) as unknown as typeof fetch;

    const dismissedEvents: number[] = [];
    const onDismissed = () => dismissedEvents.push(Date.now());
    window.addEventListener('ronduel_splash_dismissed', onDismissed);

    render(<SplashScreen />);

    // Zero interactive buttons in splash
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    const splash = screen.getByTestId('pwa-splash');
    expect(splash.getAttribute('role')).toBe('status');
    expect(splash.getAttribute('aria-live')).toBe('polite');
    expect(splash.className).toContain('rd-splash-overlay');

    // Before status loads, never shows "Round #1"
    const roundChip = screen.getByTestId('splash-round-chip');
    expect(roundChip.textContent).not.toContain('Round #1');
    expect(roundChip.style.visibility).toBe('hidden');

    // Resolve status with Round #42
    await act(async () => {
      resolveStatus({
        ok: true,
        json: async () => ({
          roundNumber: 42,
          themeKey: 'worldScience',
          played: false,
          streakCurrent: 3,
        }),
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId('splash-round-chip').textContent).toContain('#42');

    // Advance up to 1600ms + 250ms fade -> dismissed & unmounted
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(dismissedEvents).toHaveLength(1);
    expect(screen.getByTestId('pwa-splash').className).toContain('pointer-events-none');

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByTestId('pwa-splash')).toBeNull();
    window.removeEventListener('ronduel_splash_dismissed', onDismissed);
  });

  it('omits fade class and unmounts immediately under prefers-reduced-motion', async () => {
    mockMatchMedia(true);

    render(<SplashScreen />);

    const splash = screen.getByTestId('pwa-splash');
    expect(splash.className).not.toContain('rd-splash-overlay');

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    // Unmounted directly with no 250ms fade delay
    expect(screen.queryByTestId('pwa-splash')).toBeNull();
  });

  it('never redirects to /result when status.played is true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        roundNumber: 12,
        themeKey: 'historyLogic',
        played: true,
        playId: 'play_already_done_12',
        streakCurrent: 5,
      }),
    }) as unknown as typeof fetch;

    render(<SplashScreen />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(window.location.pathname).not.toContain('/result');
    expect(screen.getByTestId('splash-tagline').textContent).toContain('#13');
  });
});
