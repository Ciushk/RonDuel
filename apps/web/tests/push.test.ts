// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsSupported = vi.fn();
const mockGetMessaging = vi.fn();
const mockGetToken = vi.fn();
const mockDeleteToken = vi.fn();
const mockGetIdToken = vi.fn();
const mockSignInAnonymously = vi.fn();

vi.mock('firebase/messaging', () => ({
  isSupported: (...args: unknown[]) => mockIsSupported(...args),
  getMessaging: (...args: unknown[]) => mockGetMessaging(...args),
  getToken: (...args: unknown[]) => mockGetToken(...args),
  deleteToken: (...args: unknown[]) => mockDeleteToken(...args),
}));

vi.mock('firebase/auth', () => ({
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
}));

const mockFirebaseApp = { name: '[DEFAULT]' };
const mockAuth = {
  currentUser: {
    uid: 'u_push_1',
    getIdToken: () => mockGetIdToken(),
  } as { uid: string; getIdToken: () => Promise<string> } | null,
};

vi.mock('@/lib/firebase', () => ({
  getFirebaseApp: () => mockFirebaseApp,
  getFirebaseAuth: () => mockAuth,
}));

vi.mock('@/lib/session', () => ({
  getLocalSession: () => ({ uid: 'u_push_1' }),
}));

import {
  __resetPushWarningsForTests,
  disablePush,
  dismissPushCard,
  enablePush,
  getPermission,
  hasVapidKey,
  isPushSupported,
  PUSH_CARD_SNOOZE_MS,
  PUSH_TOKEN_STORAGE_KEY,
  refreshPushToken,
  shouldShowPushOptInCard,
} from '@/lib/push';

function setupPushBrowserEnv(
  opts: {
    permission?: NotificationPermission;
    requestPermissionImpl?: () => Promise<NotificationPermission>;
    userAgent?: string;
    platform?: string;
    maxTouchPoints?: number;
    standalone?: boolean;
    swReg?: ServiceWorkerRegistration;
  } = {},
) {
  const perm = opts.permission ?? 'default';
  const reqPerm =
    opts.requestPermissionImpl ?? vi.fn().mockResolvedValue('granted' as NotificationPermission);

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      permission: perm,
      requestPermission: reqPerm,
    },
  });

  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function PushManager() {},
  });

  const swReg = opts.swReg ?? ({ scope: '/' } as ServiceWorkerRegistration);
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(swReg) },
  });

  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value:
      opts.userAgent ??
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: opts.platform ?? 'Linux armv8l',
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: opts.maxTouchPoints ?? 5,
  });
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: Boolean(opts.standalone),
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: Boolean(opts.standalone) && query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

  return { reqPerm, swReg };
}

describe('client web push helper (apps/web/lib/push.ts)', () => {
  const originalFetch = globalThis.fetch;
  const originalVapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resetPushWarningsForTests();
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'BTestVapidPublicKey1234567890';
    mockIsSupported.mockResolvedValue(true);
    mockGetMessaging.mockReturnValue({ _tag: 'messaging' });
    mockGetToken.mockResolvedValue('fcm_token_valid_1234567890');
    mockDeleteToken.mockResolvedValue(true);
    mockGetIdToken.mockResolvedValue('firebase_id_token_abc');
    mockAuth.currentUser = {
      uid: 'u_push_1',
      getIdToken: () => mockGetIdToken(),
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalVapid === undefined) {
      delete process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    } else {
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = originalVapid;
    }
  });

  it('calls Notification.requestPermission() BEFORE any fetch, gets FCM token with SW registration & vapidKey, and POSTs with Bearer token', async () => {
    const callOrder: string[] = [];
    const fakeSwReg = { scope: '/sw-test/' } as ServiceWorkerRegistration;

    const { reqPerm } = setupPushBrowserEnv({
      permission: 'default',
      swReg: fakeSwReg,
      requestPermissionImpl: vi.fn(async (): Promise<NotificationPermission> => {
        callOrder.push('requestPermission');
        return 'granted';
      }),
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      callOrder.push(`fetch:${String(input)}:${init?.method ?? 'GET'}`);
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const outcome = await enablePush({ locale: 'ro', uid: 'u_push_1' });

    expect(outcome).toBe('granted');
    expect(reqPerm).toHaveBeenCalledTimes(1);
    expect(callOrder[0]).toBe('requestPermission');

    expect(mockGetToken).toHaveBeenCalledWith(
      { _tag: 'messaging' },
      {
        vapidKey: 'BTestVapidPublicKey1234567890',
        serviceWorkerRegistration: fakeSwReg,
      },
    );

    // Token POST with Bearer header
    const tokenCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/notify/token');
    expect(tokenCall).toBeTruthy();
    const [, tokenInit] = tokenCall!;
    expect(tokenInit?.method).toBe('POST');
    expect((tokenInit?.headers as Record<string, string>)?.Authorization).toBe(
      'Bearer firebase_id_token_abc',
    );
    const parsedBody = JSON.parse(String(tokenInit?.body));
    expect(parsedBody).toEqual({
      token: 'fcm_token_valid_1234567890',
      platform: 'android',
      locale: 'ro',
    });

    // Token stored locally and prefs synced with Bearer header
    expect(window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY)).toBe('fcm_token_valid_1234567890');
    const prefsCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/notify/prefs');
    expect(prefsCall).toBeTruthy();
    expect((prefsCall![1]?.headers as Record<string, string>)?.Authorization).toBe(
      'Bearer firebase_id_token_abc',
    );
    expect(JSON.parse(String(prefsCall![1]?.body)).pushEnabled).toBe(true);
  });

  it('does NOT call getToken or POST /api/notify/token when permission is denied', async () => {
    setupPushBrowserEnv({
      permission: 'default',
      requestPermissionImpl: vi.fn().mockResolvedValue('denied'),
    });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const outcome = await enablePush({ locale: 'en' });
    expect(outcome).toBe('denied');
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides opt-in card and logs a single warning when VAPID key is missing', () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    setupPushBrowserEnv({ permission: 'default' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(hasVapidKey()).toBe(false);
    expect(hasVapidKey()).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(shouldShowPushOptInCard({ finishedPlaysCount: 3 })).toBe(false);

    warnSpy.mockRestore();
  });

  it('enforces iOS 16.4+ standalone requirement and 14-day snooze / 2-dismissal cap on opt-in card', () => {
    // iOS Safari tab (not standalone) -> unsupported
    setupPushBrowserEnv({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      standalone: false,
    });
    expect(isPushSupported()).toBe(false);
    expect(getPermission()).toBe('unsupported');
    expect(shouldShowPushOptInCard({ finishedPlaysCount: 2 })).toBe(false);

    // iOS 16.4+ standalone -> supported
    setupPushBrowserEnv({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      standalone: true,
    });
    expect(isPushSupported()).toBe(true);
    const day0 = new Date('2026-11-01T12:00:00Z').getTime();
    expect(shouldShowPushOptInCard({ finishedPlaysCount: 1, now: day0 })).toBe(true);

    // Dismiss #1 -> snoozed for 14 days
    dismissPushCard(day0);
    expect(shouldShowPushOptInCard({ finishedPlaysCount: 2, now: day0 + 1000 })).toBe(false);
    expect(
      shouldShowPushOptInCard({ finishedPlaysCount: 15, now: day0 + PUSH_CARD_SNOOZE_MS }),
    ).toBe(true);

    // Dismiss #2 -> never shown again
    dismissPushCard(day0 + PUSH_CARD_SNOOZE_MS);
    expect(
      shouldShowPushOptInCard({
        finishedPlaysCount: 50,
        now: day0 + PUSH_CARD_SNOOZE_MS * 4,
      }),
    ).toBe(false);
  });

  it('refreshPushToken re-POSTs only when token rotates and disablePush cleans up', async () => {
    setupPushBrowserEnv({ permission: 'granted' });
    window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, 'old_token_1234567890');
    mockGetToken.mockResolvedValue('rotated_token_9876543210');

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await refreshPushToken('en');
    expect(window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY)).toBe('rotated_token_9876543210');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notify/token',
      expect.objectContaining({ method: 'POST' }),
    );

    fetchMock.mockClear();
    await disablePush({ uid: 'u_push_1' });
    expect(mockDeleteToken).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notify/token',
      expect.objectContaining({ method: 'DELETE' }),
    );
    const disablePrefsCall = fetchMock.mock.calls.find(
      ([url]) => String(url) === '/api/notify/prefs',
    );
    expect(disablePrefsCall).toBeTruthy();
    expect((disablePrefsCall![1]?.headers as Record<string, string>)?.Authorization).toBe(
      'Bearer firebase_id_token_abc',
    );
    expect(JSON.parse(String(disablePrefsCall![1]?.body)).pushEnabled).toBe(false);
  });
});
