// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

const mockHasRealAccount = vi.fn<() => Promise<boolean>>();
const mockUseIsRealAccount = vi.fn<() => { ready: boolean; isReal: boolean }>();
const mockLinkSessionWithGoogle = vi.fn();
const mockLinkSessionWithPassword = vi.fn();
const mockGetFirebaseAuth = vi.fn();
const mockLoginWithGoogle = vi.fn();
const mockLoginWithEmail = vi.fn();
const mockResendEmailVerificationSafe = vi.fn();
const mockAlignFirebaseIdentity = vi.fn();

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useFormatter: () => ({
    number: (val: number) => `€${val.toFixed(2)}`,
  }),
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
  usePathname: () => '/en/pro',
}));

vi.mock('@/lib/account-state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/account-state')>();
  return {
    ...actual,
    hasRealAccount: (...args: Parameters<typeof actual.hasRealAccount>) =>
      args.length > 0 ? actual.hasRealAccount(...args) : mockHasRealAccount(),
    useIsRealAccount: (...args: Parameters<typeof actual.useIsRealAccount>) =>
      args.length > 0 ? actual.useIsRealAccount(...args) : mockUseIsRealAccount(),
  };
});

vi.mock('@/lib/link-account', () => ({
  linkSessionWithGoogle: (...args: unknown[]) => mockLinkSessionWithGoogle(...args),
  linkSessionWithPassword: (...args: unknown[]) => mockLinkSessionWithPassword(...args),
}));

vi.mock('@/lib/billing-identity', () => ({
  alignFirebaseIdentity: (...args: unknown[]) => mockAlignFirebaseIdentity(...args),
  getBillingIdToken: vi.fn().mockResolvedValue('mock_aligned_token'),
  getBillingIdTokenWithResult: vi.fn().mockResolvedValue({
    token: 'mock_aligned_token',
    alignment: { status: 'aligned', uid: 'u_linked_1' },
  }),
}));

vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => mockGetFirebaseAuth(),
  loginWithGoogle: (...args: unknown[]) => mockLoginWithGoogle(...args),
  loginWithEmail: (...args: unknown[]) => mockLoginWithEmail(...args),
  resendEmailVerificationSafe: (...args: unknown[]) => mockResendEmailVerificationSafe(...args),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import ProPaywallPage from '@/app/[locale]/pro/page';
import { PaymentAuthGateProvider, usePaymentAuthGate } from '@/components/PaymentAuthGate';
import { clearServerAccountCache, hasRealAccount } from '@/lib/account-state';
import { saveLocalSession } from '@/lib/session';

function TestTrigger({ onPay }: { onPay: () => void }) {
  const { requireAccount } = usePaymentAuthGate();
  return (
    <button
      type="button"
      data-testid="pay-trigger"
      onClick={() => {
        void requireAccount({ kind: 'pro_checkout', label: '€39.99 / year' }, onPay);
      }}
    >
      Activate Pro
    </button>
  );
}

describe('PaymentAuthGate & hasRealAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearServerAccountCache();
    mockUseIsRealAccount.mockReturnValue({ ready: true, isReal: false });
    mockAlignFirebaseIdentity.mockResolvedValue({ status: 'aligned', uid: 'u_linked_1' });
    mockLoginWithGoogle.mockResolvedValue({ uid: 'fb_google_reauth' });
    mockLoginWithEmail.mockResolvedValue({ uid: 'fb_email_reauth' });
    mockResendEmailVerificationSafe.mockResolvedValue(true);
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls the payment action immediately without rendering the gate or leaving loading visible for a real account', async () => {
    mockUseIsRealAccount.mockReturnValue({ ready: true, isReal: true });
    mockHasRealAccount.mockResolvedValue(true);
    const onPay = vi.fn();

    render(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    fireEvent.click(screen.getByTestId('pay-trigger'));

    await waitFor(() => {
      expect(onPay).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
    expect(screen.queryByTestId('payment-gate-auth-loading')).toBeNull();
  });

  it('renders the gate for an anonymous guest, shows success text, and runs the action once after Google link', async () => {
    vi.useFakeTimers();
    mockHasRealAccount.mockResolvedValue(false);
    mockLinkSessionWithGoogle.mockResolvedValue({
      uid: 'u_linked_1',
      email: 'player@example.com',
      nickname: 'Player',
      authProvider: 'google.com',
    });
    const onPay = vi.fn();

    render(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('pay-trigger'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('payment-auth-gate')).not.toBeNull();
    expect(onPay).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('payment-gate-google-btn'));
      await Promise.resolve();
    });

    expect(mockLinkSessionWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('payment-gate-success').textContent).toContain(
      'Account saved — opening payment…',
    );
    expect(onPay).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(onPay).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
  });

  it('never calls the pending action when "Not now" is clicked', async () => {
    mockHasRealAccount.mockResolvedValue(false);
    const onPay = vi.fn();

    render(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    fireEvent.click(screen.getByTestId('pay-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('payment-auth-gate')).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId('payment-gate-not-now-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
    });
    expect(onPay).not.toHaveBeenCalled();
  });

  it('closes the gate on Escape and returns focus to the triggering button', async () => {
    mockHasRealAccount.mockResolvedValue(false);
    const onPay = vi.fn();

    render(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    const trigger = screen.getByTestId('pay-trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('payment-auth-gate')).not.toBeNull();
      expect(document.activeElement).toBe(screen.getByTestId('payment-gate-google-btn'));
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
    expect(onPay).not.toHaveBeenCalled();
  });

  it('shows payment-gate-auth-loading (not gate) while Auth is not ready, then runs action once ready as real user', async () => {
    mockUseIsRealAccount.mockReturnValue({ ready: false, isReal: false });
    mockHasRealAccount.mockResolvedValue(true);
    const onPay = vi.fn();

    const { rerender } = render(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    fireEvent.click(screen.getByTestId('pay-trigger'));

    await waitFor(() => {
      const loader = screen.getByTestId('payment-gate-auth-loading');
      expect(loader).not.toBeNull();
      expect(loader.getAttribute('aria-busy')).toBe('true');
      expect(loader.textContent).toContain('Loading');
    });
    expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
    expect(onPay).not.toHaveBeenCalled();

    // Auth finishes hydrating with a real user
    mockUseIsRealAccount.mockReturnValue({ ready: true, isReal: true });
    rerender(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    await waitFor(() => {
      expect(onPay).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('payment-gate-auth-loading')).toBeNull();
    expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
  });

  it('shows payment-gate-auth-loading while Auth is not ready, then opens gate once ready as guest', async () => {
    mockUseIsRealAccount.mockReturnValue({ ready: false, isReal: false });
    mockHasRealAccount.mockResolvedValue(false);
    const onPay = vi.fn();

    const { rerender } = render(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    fireEvent.click(screen.getByTestId('pay-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('payment-gate-auth-loading')).not.toBeNull();
    });
    expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
    expect(onPay).not.toHaveBeenCalled();

    // Auth finishes hydrating with an anonymous guest
    mockUseIsRealAccount.mockReturnValue({ ready: true, isReal: false });
    rerender(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-auth-gate')).not.toBeNull();
    });
    expect(screen.queryByTestId('payment-gate-auth-loading')).toBeNull();
    expect(onPay).not.toHaveBeenCalled();
  });

  it('confirms non-anonymous local sessions via /api/me/profile including email_link/google/password and rejects anonymous', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        isAnonymous: false,
        email: 'verified@example.com',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    for (const provider of [
      'password',
      'google',
      'google.com',
      'email_password',
      'email_link',
    ] as const) {
      saveLocalSession({
        uid: `u_verified_${provider}`,
        nickname: 'Verified',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
        email: 'verified@example.com',
        isAnonymous: false,
        authProvider: provider,
      });
      const isVerifiedReal = await hasRealAccount({ getAuthFn: () => null, fetchFn: fetchMock });
      expect(isVerifiedReal, `provider ${provider}`).toBe(true);
    }

    saveLocalSession({
      uid: 'u_guest_local',
      nickname: 'Guest',
      ageConfirmed16: true,
      relaxedTimer: false,
      theme: 'light',
      analyticsConsent: 'rejected',
      email: 'verified@example.com',
      isAnonymous: false,
      authProvider: 'anonymous',
    });
    expect(await hasRealAccount({ getAuthFn: () => null, fetchFn: fetchMock })).toBe(false);
  });

  it('bypasses PaymentAuthGate for a user without Firebase Auth whose RonDuel session is confirmed by /api/me/profile', async () => {
    const mockAuthWithNullUser = {
      currentUser: null,
      authStateReady: () => Promise.resolve(),
      onAuthStateChanged: () => () => {},
      onIdTokenChanged: () => () => {},
    };
    mockGetFirebaseAuth.mockReturnValue(mockAuthWithNullUser);

    saveLocalSession({
      uid: 'u_andrei89',
      nickname: 'Andrei',
      ageConfirmed16: true,
      relaxedTimer: false,
      theme: 'light',
      analyticsConsent: 'rejected',
      email: 'eu.andrei89@gmail.com',
      isAnonymous: false,
      authProvider: 'google',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        uid: 'u_andrei89',
        isAnonymous: false,
        email: 'eu.andrei89@gmail.com',
        authProvider: 'google',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Delegate requireAccount's hasRealAccount() to the real implementation with Firebase currentUser=null
    mockUseIsRealAccount.mockReturnValue({ ready: true, isReal: true });
    mockHasRealAccount.mockImplementation(() =>
      hasRealAccount({
        getAuthFn: () => mockAuthWithNullUser as unknown as import('firebase/auth').Auth,
        fetchFn: fetchMock,
      }),
    );

    const onPay = vi.fn();
    render(
      <PaymentAuthGateProvider>
        <TestTrigger onPay={onPay} />
      </PaymentAuthGateProvider>,
    );

    fireEvent.click(screen.getByTestId('pay-trigger'));

    await waitFor(() => {
      expect(onPay).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('payment-auth-gate')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/profile?uid=u_andrei89',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('/pro hides upgradeFirst box when isReal is true or ready is false, and renders it only for ready guests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isAnonymous: true, pro: { active: false } }),
      }),
    );

    // 1. Auth loading (ready: false) -> box must NOT render
    mockUseIsRealAccount.mockReturnValue({ ready: false, isReal: false });
    const { rerender } = render(
      <PaymentAuthGateProvider>
        <ProPaywallPage />
      </PaymentAuthGateProvider>,
    );
    expect(screen.queryByTestId('pro-upgrade-first-box')).toBeNull();

    // 2. Real user (ready: true, isReal: true) -> box must NOT render
    mockUseIsRealAccount.mockReturnValue({ ready: true, isReal: true });
    rerender(
      <PaymentAuthGateProvider>
        <ProPaywallPage />
      </PaymentAuthGateProvider>,
    );
    expect(screen.queryByTestId('pro-upgrade-first-box')).toBeNull();

    // 3. Guest (ready: true, isReal: false) -> box renders
    mockUseIsRealAccount.mockReturnValue({ ready: true, isReal: false });
    rerender(
      <PaymentAuthGateProvider>
        <ProPaywallPage />
      </PaymentAuthGateProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('pro-upgrade-first-box')).not.toBeNull();
    });
  });

  it('reauth mode renders confirmation copy without guest chips, aligns identity, and runs the pending action', async () => {
    vi.useFakeTimers();
    saveLocalSession({
      uid: 'u_andrei89',
      nickname: 'Andrei',
      ageConfirmed16: true,
      relaxedTimer: false,
      theme: 'light',
      analyticsConsent: 'rejected',
      email: 'eu.andrei89@gmail.com',
      isAnonymous: false,
      authProvider: 'google.com',
    });
    mockAlignFirebaseIdentity.mockResolvedValue({ status: 'aligned', uid: 'u_andrei89' });
    const onPay = vi.fn();

    function ReauthTrigger() {
      const { openGate } = usePaymentAuthGate();
      return (
        <button
          type="button"
          data-testid="reauth-trigger"
          onClick={() =>
            openGate(
              { kind: 'pro_checkout', label: '€4.99 / month' },
              { mode: 'reauth', action: onPay },
            )
          }
        >
          Reauth Pay
        </button>
      );
    }

    render(
      <PaymentAuthGateProvider>
        <ReauthTrigger />
      </PaymentAuthGateProvider>,
    );

    fireEvent.click(screen.getByTestId('reauth-trigger'));
    const gate = screen.getByTestId('payment-auth-gate');
    expect(gate.getAttribute('data-mode')).toBe('reauth');
    expect(gate.textContent).toContain('Confirm your account to pay');
    expect(gate.textContent).toContain('eu.andrei89@gmail.com');
    expect(gate.textContent).not.toContain('Create an account to keep your data');
    expect(gate.textContent).not.toContain('Your guest progress moves');

    await act(async () => {
      fireEvent.click(screen.getByTestId('payment-gate-google-btn'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockLinkSessionWithGoogle).not.toHaveBeenCalled();
    expect(mockAlignFirebaseIdentity).toHaveBeenCalledTimes(1);
    expect(onPay).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('reauth mode blocks pending action on EMAIL_NOT_VERIFIED (with resend button) and on ACCOUNT_MISMATCH', async () => {
    saveLocalSession({
      uid: 'u_andrei89',
      nickname: 'Andrei',
      ageConfirmed16: true,
      relaxedTimer: false,
      theme: 'light',
      analyticsConsent: 'rejected',
      email: 'eu.andrei89@gmail.com',
      isAnonymous: false,
      authProvider: 'google.com',
    });
    const onPay = vi.fn();

    function ReauthTrigger() {
      const { openGate } = usePaymentAuthGate();
      return (
        <button
          type="button"
          data-testid="reauth-trigger"
          onClick={() =>
            openGate({ kind: 'town_coins', label: 'RonCoins' }, { mode: 'reauth', action: onPay })
          }
        >
          Reauth Pay
        </button>
      );
    }

    render(
      <PaymentAuthGateProvider>
        <ReauthTrigger />
      </PaymentAuthGateProvider>,
    );

    fireEvent.click(screen.getByTestId('reauth-trigger'));

    // 1. EMAIL_NOT_VERIFIED shows error + resend button and blocks action
    mockAlignFirebaseIdentity.mockResolvedValueOnce({
      status: 'error',
      code: 'EMAIL_NOT_VERIFIED',
    });
    fireEvent.click(screen.getByTestId('payment-gate-google-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('payment-gate-resend-verification-btn')).not.toBeNull();
    });
    fireEvent.click(screen.getByTestId('payment-gate-resend-verification-btn'));
    await waitFor(() => {
      expect(mockResendEmailVerificationSafe).toHaveBeenCalledTimes(1);
    });
    expect(onPay).not.toHaveBeenCalled();

    // 2. ACCOUNT_MISMATCH (foreign uid) keeps gate open and never runs payment action
    mockAlignFirebaseIdentity.mockResolvedValueOnce({
      status: 'needs_sign_in',
      code: 'ACCOUNT_MISMATCH',
    });
    fireEvent.click(screen.getByTestId('payment-gate-google-btn'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('eu.andrei89@gmail.com');
    });
    expect(onPay).not.toHaveBeenCalled();
  });
});
