// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();
const mockRouter = {
  replace: mockRouterReplace,
  push: mockRouterPush,
};
const mockTrackEvent = vi.fn();

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
  usePathname: () => '/en/result/play_1',
  useParams: () => ({ playId: 'play_1' }),
  useRouter: () => mockRouter,
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
  }) => React.createElement('a', { href, ...rest }, children),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

let mockSession = {
  uid: 'u_install_test',
  nickname: 'Tester',
  ageConfirmed16: true,
  isAnonymous: true,
  email: undefined as string | undefined,
};

vi.mock('@/lib/session', () => ({
  getLocalSession: () => mockSession,
  saveLocalSession: vi.fn(),
  getBrowserTimeZone: () => 'UTC',
  vibrate: vi.fn(),
}));

vi.mock('@/lib/feature-flags', () => ({
  useFeatureFlag: () => false,
}));

vi.mock('@/components/CreateLeagueDialog', () => ({
  CreateLeagueDialog: () => null,
}));

vi.mock('@/components/JoinByCodeDialog', () => ({
  JoinByCodeDialog: () => null,
}));

vi.mock('@/components/AccountLinkingSheet', () => ({
  AccountLinkingSheet: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
  }) =>
    open
      ? React.createElement(
          'div',
          { 'data-testid': 'mock-account-link-sheet' },
          React.createElement(
            'button',
            { type: 'button', 'data-testid': 'close-link-sheet', onClick: onClose },
            'Close link sheet',
          ),
        )
      : null,
}));

import ResultPage from '@/app/[locale]/result/[playId]/page';
import {
  __resetInstallPromptForTests,
  __setDeferredPromptForTests,
  canPromptInstall,
  INSTALL_SNOOZE_MS,
  initInstallPromptCapture,
  promptInstall,
  readInstallState,
  recordInstallAccepted,
  recordInstallIosGotIt,
  recordInstallLater,
  recordInstallPromptShown,
  shouldShowInstallPrompt,
  type BeforeInstallPromptEvent,
} from '@/lib/install-prompt';

function mockEnv({
  userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/124.0.0.0 Mobile Safari/537.36',
  platform = 'Linux armv8l',
  maxTouchPoints = 5,
  standalone = false,
  reducedMotion = false,
} = {}) {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
  Object.defineProperty(window.navigator, 'platform', { configurable: true, value: platform });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: standalone });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches:
        (query === '(prefers-reduced-motion: reduce)' && reducedMotion) ||
        (query === '(display-mode: standalone)' && standalone),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('install prompt state machine & ResultPage orchestration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetInstallPromptForTests();
    mockSession = {
      uid: 'u_install_test',
      nickname: 'Tester',
      ageConfirmed16: true,
      isAnonymous: false,
      email: 'player@example.com',
    };
    mockEnv();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    __resetInstallPromptForTests();
    globalThis.fetch = originalFetch;
  });

  it('shows on the first finished round and never when standalone', () => {
    const now = new Date('2026-11-26T12:00:00Z').getTime();

    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 1,
        now,
        platform: 'chromium-prompt',
        standalone: false,
      }),
    ).toBe(true);

    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 1,
        now,
        platform: 'chromium-prompt',
        standalone: true,
      }),
    ).toBe(false);

    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 1,
        now,
        platform: 'none',
        standalone: false,
      }),
    ).toBe(false);
  });

  it('snoozes for 7 days after Later, shows again after 7 days, and never shows after 2 Laters', () => {
    const day0 = new Date('2026-11-01T12:00:00Z').getTime();

    // First show + Later
    recordInstallPromptShown(day0);
    recordInstallLater(day0);

    // Same day -> hidden
    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 2,
        now: day0 + 60_000,
        platform: 'chromium-prompt',
        standalone: false,
      }),
    ).toBe(false);

    // 6 days later -> still snoozed
    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 6,
        now: day0 + INSTALL_SNOOZE_MS - 1000,
        platform: 'chromium-prompt',
        standalone: false,
      }),
    ).toBe(false);

    // 7 days later -> eligible again
    const day7 = day0 + INSTALL_SNOOZE_MS;
    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 7,
        now: day7,
        platform: 'chromium-prompt',
        standalone: false,
      }),
    ).toBe(true);

    // Second show + 2nd Later -> never shows again
    recordInstallPromptShown(day7);
    recordInstallLater(day7);
    const day30 = day7 + INSTALL_SNOOZE_MS * 3;
    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 30,
        now: day30,
        platform: 'chromium-prompt',
        standalone: false,
      }),
    ).toBe(false);
  });

  it('allows one iOS follow-up reminder 7 days after Got it if still not standalone, then never again', () => {
    const day0 = new Date('2026-11-01T12:00:00Z').getTime();
    recordInstallPromptShown(day0);
    recordInstallIosGotIt(day0);

    // Day 3 -> hidden
    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 3,
        now: day0 + 3 * 24 * 3600 * 1000,
        platform: 'ios-howto',
        standalone: false,
      }),
    ).toBe(false);

    // Day 7 -> still not standalone -> allowed ONCE
    const day7 = day0 + INSTALL_SNOOZE_MS;
    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 7,
        now: day7,
        platform: 'ios-howto',
        standalone: false,
      }),
    ).toBe(true);

    // Showing that reminder consumes it and counts it as a later
    const afterReminder = recordInstallPromptShown(day7);
    expect(afterReminder.laterCount).toBe(1);
    expect(afterReminder.iosReminderPending).toBe(false);

    // Day 20 -> never again
    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 20,
        now: day7 + INSTALL_SNOOZE_MS * 2,
        platform: 'ios-howto',
        standalone: false,
      }),
    ).toBe(false);
  });

  it('captures beforeinstallprompt and marks installed on appinstalled', async () => {
    initInstallPromptCapture();
    expect(canPromptInstall()).toBe(false);

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const evt = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
    Object.defineProperty(evt, 'prompt', { value: promptMock });
    Object.defineProperty(evt, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    window.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(canPromptInstall()).toBe(true);

    const outcome = await promptInstall();
    expect(outcome).toBe('accepted');
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(canPromptInstall()).toBe(false);

    window.dispatchEvent(new Event('appinstalled'));
    expect(readInstallState().installed).toBe(true);
    expect(mockTrackEvent).toHaveBeenCalledWith('pwa_installed');
  });

  it('marks accepted install permanently done', () => {
    const day0 = new Date('2026-11-01T12:00:00Z').getTime();
    recordInstallPromptShown(day0);
    recordInstallAccepted();

    expect(
      shouldShowInstallPrompt({
        finishedPlaysCount: 5,
        now: day0 + INSTALL_SNOOZE_MS * 2,
        platform: 'chromium-prompt',
        standalone: false,
      }),
    ).toBe(false);
  });

  it('waits until AccountLinkingSheet closes (then opens 600ms later) and pauses the auto-home timer while open', async () => {
    vi.useFakeTimers();

    // Guest on round 1 -> AccountLinkingSheet is scheduled at 1000ms
    mockSession = {
      uid: 'u_guest_1',
      nickname: 'Guest1',
      ageConfirmed16: true,
      isAnonymous: true,
      email: undefined,
    };

    const fakeDeferred = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
    } as unknown as BeforeInstallPromptEvent;
    __setDeferredPromptForTests(fakeDeferred);

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/game/result/')) {
        return {
          ok: true,
          json: async () => ({
            playId: 'play_1',
            date: '2026-11-26',
            roundNumber: 42,
            totalScore: 720,
            totalMs: 12000,
            emojiLine: '🟩🟩🟩🟩🟥🟥',
            streakCurrent: 1,
            streakBest: 1,
            finishedPlaysCount: 1,
            review: [],
            leagueRanks: [],
            primaryLeague: null,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    render(React.createElement(ResultPage));

    // Let fetch resolve
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // At 1000ms AccountLinkingSheet opens; InstallAppSheet MUST NOT open yet
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('mock-account-link-sheet')).toBeTruthy();
    expect(screen.queryByTestId('install-app-sheet')).toBeNull();

    // Even after 5 seconds with link sheet still open, InstallAppSheet stays hidden
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId('install-app-sheet')).toBeNull();

    // Close the account linking sheet
    fireEvent.click(screen.getByTestId('close-link-sheet'));

    // Before 600ms -> still closed
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId('install-app-sheet')).toBeNull();

    // At 600ms -> InstallAppSheet opens!
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('install-app-sheet')).toBeTruthy();
    expect(mockTrackEvent).toHaveBeenCalledWith('install_prompt_shown', {
      platform: 'chromium-prompt',
    });

    // While InstallAppSheet is open, neither the 10s auto-home nor the 15s countdown navigates away
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();

    // Dismissing with Later records laterCount = 1 and closes the sheet
    fireEvent.click(screen.getByTestId('install-later-btn'));
    expect(screen.queryByTestId('install-app-sheet')).toBeNull();
    expect(readInstallState().laterCount).toBe(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('install_prompt_result', {
      platform: 'chromium-prompt',
      outcome: 'later',
    });

    // After InstallAppSheet closes, auto-home fires 10s later
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockRouterReplace).toHaveBeenCalledWith('/en');
  });

  it('shows InstallAppSheet 800ms after data loads with reduced motion and renders iOS steps + iPhone pointer (hidden on iPad)', async () => {
    vi.useFakeTimers();

    // iPhone iOS 16.4+ with reduced motion
    mockEnv({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      reducedMotion: true,
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/game/result/')) {
        return {
          ok: true,
          json: async () => ({
            playId: 'play_1',
            date: '2026-11-26',
            roundNumber: 42,
            totalScore: 810,
            totalMs: 11000,
            emojiLine: '⚡🟩🟩🟩🟩🟥',
            streakCurrent: 1,
            streakBest: 1,
            finishedPlaysCount: 1,
            review: [],
            leagueRanks: [],
            primaryLeague: null,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    render(React.createElement(ResultPage));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    const sheet = screen.getByTestId('install-app-sheet');
    expect(sheet.getAttribute('data-platform')).toBe('ios-howto');
    expect(screen.getByTestId('install-ios-pointer')).toBeTruthy();
    expect(screen.getByTestId('install-ios-note').textContent).toContain('iOS 16.4+');
    expect(sheet.querySelectorAll('ol > li')).toHaveLength(3);

    // Escape counts as Later
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('install-app-sheet')).toBeNull();
    expect(readInstallState().laterCount).toBe(1);
  });
});
