// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const base = namespace
      ? (enMessages as Record<string, unknown>)[namespace]
      : (enMessages as Record<string, unknown>);
    const fn = (key: string, values?: Record<string, string | number>) => {
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
    fn.rich = (key: string, values?: Record<string, unknown>) => {
      const text = fn(
        key,
        values
          ? Object.fromEntries(
              Object.entries(values).filter(
                ([, v]) => typeof v === 'string' || typeof v === 'number',
              ) as Array<[string, string | number]>,
            )
          : undefined,
      );
      return text;
    };
    return fn;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/PaymentAuthGate', () => ({
  usePaymentAuthGate: () => ({ requireAccount: vi.fn() }),
}));

vi.mock('@/components/CreateLeagueWizard', () => ({
  CreateLeagueWizard: () => null,
}));

vi.mock('@/components/AuthModal', () => ({
  AuthModal: ({ open, initialMode }: { open: boolean; initialMode: string }) =>
    open ? <div data-testid="mock-auth-modal" data-mode={initialMode} /> : null,
}));

vi.mock('@/components/GuestAccountNotice', () => ({
  GuestAccountNotice: () => null,
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => null,
  logoutUser: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('@/lib/link-account', () => ({
  linkSessionWithGoogle: vi.fn(),
}));

let mockSession: {
  uid: string;
  nickname: string;
  email?: string;
  isAnonymous: boolean;
  authProvider: string;
} = {
  uid: 'u_signed_1',
  nickname: 'Tester',
  email: 'tester@example.com',
  isAnonymous: false,
  authProvider: 'google.com',
};

vi.mock('@/lib/session', () => ({
  getLocalSession: () => mockSession,
  saveLocalSession: vi.fn(),
  clearLocalSession: vi.fn(),
}));

let mockHasVapid = true;
let mockPushPerm: 'default' | 'granted' | 'denied' | 'unsupported' = 'default';
let mockPushPlatform: 'android' | 'ios' | 'desktop' = 'android';
const mockEnablePush = vi.fn();
const mockDisablePush = vi.fn();
const mockSendTestPush = vi.fn();
const mockGetBearerIdToken = vi.fn();

vi.mock('@/lib/push', () => ({
  hasVapidKey: () => mockHasVapid,
  getPermission: () => mockPushPerm,
  getPushPlatform: () => mockPushPlatform,
  enablePush: (...args: unknown[]) => mockEnablePush(...args),
  disablePush: (...args: unknown[]) => mockDisablePush(...args),
  sendTestPush: (...args: unknown[]) => mockSendTestPush(...args),
  getBearerIdToken: (...args: unknown[]) => mockGetBearerIdToken(...args),
}));

let mockIsIOS = false;
let mockIsStandalone = false;
let mockIosVersion: number | null = null;

vi.mock('@/lib/pwa-env', () => ({
  isIOS: () => mockIsIOS,
  isStandalone: () => mockIsStandalone,
  iosVersion: () => mockIosVersion,
  isIPad: () => false,
}));

import ProfilePage from '@/app/[locale]/me/page';

function makeProfileResponse(overrides: Record<string, unknown> = {}) {
  return {
    uid: mockSession.uid,
    nickname: mockSession.nickname,
    email: mockSession.email,
    isAnonymous: mockSession.isAnonymous,
    authProvider: mockSession.authProvider,
    isAdmin: false,
    pro: { active: false },
    notif: { pushEnabled: false, emailEnabled: false, reminderLocalTime: '18:00' },
    streakCurrent: 3,
    streakBest: 5,
    freezes: 1,
    playedDates: [],
    topicAccuracy: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

describe('Profile notification toggles (me/page.tsx + Switch)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = {
      uid: 'u_signed_1',
      nickname: 'Tester',
      email: 'tester@example.com',
      isAnonymous: false,
      authProvider: 'google.com',
    };
    mockHasVapid = true;
    mockPushPerm = 'default';
    mockPushPlatform = 'android';
    mockIsIOS = false;
    mockIsStandalone = false;
    mockIosVersion = null;
    mockEnablePush.mockResolvedValue('granted');
    mockDisablePush.mockResolvedValue(true);
    mockSendTestPush.mockResolvedValue({ ok: true });
    mockGetBearerIdToken.mockResolvedValue({ idToken: 'tok_123', uid: 'u_signed_1' });
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it('VAPID missing: push switch is aria-disabled, shows pushUnavailable, and tap does not call enablePush', async () => {
    mockHasVapid = false;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeProfileResponse())) as typeof fetch;

    render(<ProfilePage />);

    const pushSwitch = await screen.findByTestId('profile-push-switch');
    expect(pushSwitch.getAttribute('role')).toBe('switch');
    expect(pushSwitch.getAttribute('aria-disabled')).toBe('true');
    expect(pushSwitch.hasAttribute('disabled')).toBe(false);
    expect(pushSwitch.getAttribute('aria-checked')).toBe('false');

    const status = screen.getByTestId('profile-push-unavailable');
    expect(status.textContent).toContain(enMessages.profile.notif.pushUnavailable);
    expect(pushSwitch.getAttribute('aria-describedby')).toBe(status.id);

    fireEvent.click(pushSwitch);
    expect(mockEnablePush).not.toHaveBeenCalled();
    expect(status.className).toContain('rd-notif-shake-a');

    errSpy.mockRestore();
  });

  it('iOS Safari tab: shows install-first message and button opens InstallAppSheet', async () => {
    mockIsIOS = true;
    mockIsStandalone = false;
    mockIosVersion = 17.4;
    mockPushPerm = 'unsupported';
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeProfileResponse())) as typeof fetch;

    render(<ProfilePage />);

    const pushSwitch = await screen.findByTestId('profile-push-switch');
    expect(pushSwitch.getAttribute('aria-disabled')).toBe('true');

    const iosNotice = screen.getByTestId('profile-push-ios-tab');
    expect(iosNotice.textContent).toContain(enMessages.profile.notif.iosInstallFirst);

    const howToBtn = screen.getByTestId('profile-ios-install-btn');
    fireEvent.click(howToBtn);

    const sheet = await screen.findByTestId('install-app-sheet');
    expect(sheet.getAttribute('data-platform')).toBe('ios-howto');
  });

  it('denied permission: shows blocked help linked via aria-describedby', async () => {
    mockPushPerm = 'denied';
    mockPushPlatform = 'android';
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeProfileResponse())) as typeof fetch;

    render(<ProfilePage />);

    const pushSwitch = await screen.findByTestId('profile-push-switch');
    expect(pushSwitch.getAttribute('aria-disabled')).toBe('true');

    const blocked = screen.getByTestId('profile-push-blocked');
    expect(blocked.textContent).toContain(enMessages.push.blocked);
    expect(blocked.textContent).toContain(enMessages.push.blockedHelpAndroid);
    expect(pushSwitch.getAttribute('aria-describedby')).toBe(blocked.id);
  });

  it('disablePush rejecting: clears busy state and shows localized error toast in card', async () => {
    mockPushPerm = 'granted';
    let rejectDisable!: (err: Error) => void;
    mockDisablePush.mockImplementation(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectDisable = reject;
        }),
    );

    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        makeProfileResponse({
          notif: { pushEnabled: true, emailEnabled: false, reminderLocalTime: '18:00' },
        }),
      ),
    ) as typeof fetch;

    render(<ProfilePage />);

    const pushSwitch = await screen.findByTestId('profile-push-switch');
    await waitFor(() => expect(pushSwitch.getAttribute('aria-checked')).toBe('true'));

    fireEvent.click(pushSwitch);
    expect(pushSwitch.getAttribute('aria-busy')).toBe('true');
    expect(pushSwitch.getAttribute('aria-label')).toContain(enMessages.profile.notif.saving);

    await act(async () => {
      rejectDisable(new Error('network boom'));
      await Promise.resolve();
    });

    await waitFor(() => expect(pushSwitch.getAttribute('aria-busy')).toBe('false'));
    const toastSlot = screen.getByTestId('profile-notif-toast-slot');
    expect(toastSlot.textContent).toContain(enMessages.profile.notif.saveFailed);
  });

  it('email toggle: optimistic flip, busy state, then 400 EMAIL_ACCOUNT_REQUIRED rolls back with localized in-card error toast', async () => {
    let resolvePrefs!: (res: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/me/profile')) {
        return Promise.resolve(jsonResponse(makeProfileResponse()));
      }
      if (url === '/api/notify/prefs') {
        return new Promise<Response>((resolve) => {
          resolvePrefs = resolve;
        });
      }
      return Promise.resolve(jsonResponse({}));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<ProfilePage />);

    const emailSwitch = await screen.findByTestId('profile-email-switch');
    expect(emailSwitch.getAttribute('role')).toBe('switch');
    expect(emailSwitch.getAttribute('aria-checked')).toBe('false');
    expect(emailSwitch.getAttribute('aria-busy')).toBe('false');

    // Click flips optimistically right away and enters busy state
    fireEvent.click(emailSwitch);
    expect(emailSwitch.getAttribute('aria-checked')).toBe('true');
    expect(emailSwitch.getAttribute('aria-busy')).toBe('true');
    expect(emailSwitch.getAttribute('aria-label')).toContain(enMessages.profile.notif.saving);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notify/prefs',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok_123' }),
        }),
      ),
    );

    // Server answers 400 EMAIL_ACCOUNT_REQUIRED -> rollback + localized toast (never raw server text)
    await act(async () => {
      resolvePrefs(
        jsonResponse(
          { error: 'Raw English server message should never show', code: 'EMAIL_ACCOUNT_REQUIRED' },
          400,
        ),
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(emailSwitch.getAttribute('aria-busy')).toBe('false'));
    expect(emailSwitch.getAttribute('aria-checked')).toBe('false');
    const toastSlot = screen.getByTestId('profile-notif-toast-slot');
    expect(toastSlot.textContent).toContain(enMessages.profile.notif.emailNeedsAccount);
    expect(toastSlot.textContent).not.toContain('Raw English server message');
  });

  it('email toggle: network error rolls back and shows common.networkError toast in card', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/me/profile')) {
        return Promise.resolve(jsonResponse(makeProfileResponse()));
      }
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<ProfilePage />);

    const emailSwitch = await screen.findByTestId('profile-email-switch');
    expect(emailSwitch.getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      fireEvent.click(emailSwitch);
      await Promise.resolve();
    });

    await waitFor(() => expect(emailSwitch.getAttribute('aria-busy')).toBe('false'));
    expect(emailSwitch.getAttribute('aria-checked')).toBe('false');
    const toastSlot = screen.getByTestId('profile-notif-toast-slot');
    expect(toastSlot.textContent).toContain(enMessages.common.networkError);
  });

  it('anonymous user: email switch is aria-disabled with sign-in link that opens AuthModal', async () => {
    mockSession = {
      uid: 'u_anon_1',
      nickname: 'Guest',
      email: undefined,
      isAnonymous: true,
      authProvider: 'anonymous',
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeProfileResponse())) as typeof fetch;

    render(<ProfilePage />);

    const emailSwitch = await screen.findByTestId('profile-email-switch');
    expect(emailSwitch.getAttribute('aria-disabled')).toBe('true');
    expect(emailSwitch.hasAttribute('disabled')).toBe(false);

    const status = screen.getByTestId('profile-email-needs-account');
    expect(status.textContent).toContain(enMessages.profile.notif.emailNeedsAccount);
    expect(emailSwitch.getAttribute('aria-describedby')).toBe(status.id);

    const signInBtn = screen.getByTestId('profile-email-signin-btn');
    fireEvent.click(signInBtn);
    expect(screen.getByTestId('mock-auth-modal').getAttribute('data-mode')).toBe('login');
  });
});
