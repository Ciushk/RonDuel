// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

const mockHasRealAccount = vi.fn<() => Promise<boolean>>();
const mockLinkSessionWithGoogle = vi.fn();
const mockLinkSessionWithPassword = vi.fn();
const mockGetFirebaseAuth = vi.fn();

vi.mock('next-intl', () => ({
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
  };
});

vi.mock('@/lib/link-account', () => ({
  linkSessionWithGoogle: (...args: unknown[]) => mockLinkSessionWithGoogle(...args),
  linkSessionWithPassword: (...args: unknown[]) => mockLinkSessionWithPassword(...args),
}));

vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => mockGetFirebaseAuth(),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { PaymentAuthGateProvider, usePaymentAuthGate } from '@/components/PaymentAuthGate';
import { hasRealAccount } from '@/lib/account-state';
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
  });

  it('calls the payment action immediately without rendering the gate for a real account', async () => {
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

  it('treats legacy email_link-only local sessions as not real accounts', async () => {
    saveLocalSession({
      uid: 'u_legacy_email_link',
      nickname: 'Legacy',
      ageConfirmed16: true,
      relaxedTimer: false,
      theme: 'light',
      analyticsConsent: 'rejected',
      email: 'unverified@example.com',
      isAnonymous: false,
      authProvider: 'email_link',
    });

    const isReal = await hasRealAccount({ getAuthFn: () => null });
    expect(isReal).toBe(false);

    // Verified password provider IS treated as real when Firebase Auth is unavailable
    saveLocalSession({
      uid: 'u_verified_pw',
      nickname: 'Verified',
      ageConfirmed16: true,
      relaxedTimer: false,
      theme: 'light',
      analyticsConsent: 'rejected',
      email: 'verified@example.com',
      isAnonymous: false,
      authProvider: 'password',
    });
    const isVerifiedReal = await hasRealAccount({ getAuthFn: () => null });
    expect(isVerifiedReal).toBe(true);
  });
});
