// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();
const mockRouter = {
  replace: mockRouterReplace,
  push: mockRouterPush,
};
let mockSearchParamsValue = new URLSearchParams();

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
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParamsValue,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getLocalSession: () => ({
    uid: 'u_test_done',
    nickname: 'Tester',
    ageConfirmed16: true,
    isAnonymous: false,
  }),
  saveLocalSession: vi.fn(),
  getBrowserTimeZone: () => 'UTC',
}));

vi.mock('@/lib/link-account', () => ({
  syncSessionWithSignedInUser: () => Promise.resolve(),
}));

vi.mock('@/components/AccountLinkingSheet', () => ({
  AccountLinkingSheet: () => null,
}));

vi.mock('@/components/CreateLeagueDialog', () => ({
  CreateLeagueDialog: () => null,
}));

vi.mock('@/components/JoinByCodeDialog', () => ({
  JoinByCodeDialog: () => null,
}));

import HomePage from '@/app/[locale]/page';
import PlayPage from '@/app/[locale]/play/page';

const PLAYED_STATUS = {
  roundId: '2026-11-26',
  roundNumber: 42,
  themeKey: 'worldScience',
  played: true,
  inProgress: false,
  playId: 'play_today_1',
  score: 840,
  totalScore: 840,
  emojiLine: '⚡🟩🟩⚡🟩🟥',
  streakCurrent: 5,
  streakAtRisk: false,
  finishedPlaysCount: 5,
  isPro: false,
  worldLeague: {
    id: 'lg_world',
    name: 'RonDuel World',
    inviteCode: 'WORLD',
    membersCount: 120,
    playedTodayCount: 40,
    myRankToday: 3,
    isWorld: true,
  },
  privateLeagues: [],
  duels: [],
  activeDuelsCount: 0,
  maxActiveDuels: 1,
  monthlyDuelsCount: 0,
  maxMonthlyDuels: 4,
};

describe('Home "done for today" state & /play redirect', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsValue = new URLSearchParams();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('renders the done-for-today home card, countdown, See results link, and Town/Duels tiles without redirecting', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PLAYED_STATUS,
    }) as unknown as typeof fetch;

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId('home-done-card')).toBeTruthy();
    });

    // Must not redirect away from home
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();

    // Volt round-complete chip and score
    expect(screen.getByTestId('home-round-complete-chip').textContent).toContain(
      "Today's round complete",
    );
    expect(screen.getByTestId('home-done-score').textContent).toBe('840');

    // Countdown + SR text (aria-live="off")
    const countdown = screen.getByTestId('home-next-countdown');
    expect(countdown.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(countdown.getAttribute('aria-hidden')).toBe('true');

    const srCountdown = screen.getByTestId('home-next-countdown-sr');
    expect(srCountdown.getAttribute('aria-live')).toBe('off');
    expect(srCountdown.textContent).toMatch(/^Next round in \d+ h \d+ min$/);

    // Explicit "See results →" link
    const seeResults = screen.getByTestId('home-see-results-link');
    expect(seeResults.getAttribute('href')).toBe('/en/result/play_today_1');
    expect(seeResults.textContent).toContain('See results →');

    // Side-by-side RonTown & Duels sticker tiles
    const townTile = screen.getByTestId('home-town-tile');
    expect(townTile.getAttribute('href')).toBe('/en/town');
    expect(townTile.textContent).toContain('RonTown');
    expect(townTile.textContent).toContain('Harvest & build');

    const duelsTile = screen.getByTestId('home-duels-tile');
    expect(duelsTile.getAttribute('href')).toBe('/en/duels');
    expect(duelsTile.textContent).toContain('Duels');
    expect(duelsTile.textContent).toContain('Challenge a friend');

    // Duplicate RonTown entry card below Leaderboards is hidden in played state
    expect(screen.queryByTestId('home-town-entry-card')).toBeNull();
  });

  it('refreshes status automatically when the countdown ticks down to midnight', async () => {
    vi.useFakeTimers();
    // 2 seconds before UTC midnight
    vi.setSystemTime(new Date('2026-11-26T23:59:58Z'));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PLAYED_STATUS,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<HomePage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('home-next-countdown').textContent).toBe('00:00:02');
    const callsBeforeMidnight = fetchMock.mock.calls.length;

    // Advance 2 seconds to midnight (00:00:00)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeMidnight);
  });

  it('shows the normal play card and RonTown entry card when not yet played', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...PLAYED_STATUS,
        played: false,
        playId: undefined,
      }),
    }) as unknown as typeof fetch;

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId('home-play-card')).toBeTruthy();
    });

    expect(screen.queryByTestId('home-done-tiles')).toBeNull();
    expect(screen.getByTestId('home-town-entry-card')).toBeTruthy();
  });

  it('PlayPage redirects back to /en when today is already played and no returnTo is set', async () => {
    window.history.replaceState({}, '', '/en/play');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PLAYED_STATUS,
    }) as unknown as typeof fetch;

    render(<PlayPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/en');
    });
  });

  it('PlayPage keeps redirecting to /en/result/{playId}?returnTo=... when returnTo is present', async () => {
    window.history.replaceState({}, '', '/en/play?returnTo=%2Fen%2Fleagues');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PLAYED_STATUS,
    }) as unknown as typeof fetch;

    render(<PlayPage />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(
        '/en/result/play_today_1?returnTo=%2Fen%2Fleagues',
      );
    });
  });
});
