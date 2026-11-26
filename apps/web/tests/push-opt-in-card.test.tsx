// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../messages/en.json';

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

const mockEnablePush = vi.fn();
const mockSendTestPush = vi.fn();
let mockEligible = true;
let mockPlatform: 'android' | 'ios' | 'desktop' = 'android';
const mockDismissPushCard = vi.fn();

vi.mock('@/lib/push', () => ({
  enablePush: (...args: unknown[]) => mockEnablePush(...args),
  sendTestPush: (...args: unknown[]) => mockSendTestPush(...args),
  shouldShowPushOptInCard: () => mockEligible,
  getPushPlatform: () => mockPlatform,
  dismissPushCard: (...args: unknown[]) => mockDismissPushCard(...args),
}));

import { PushOptInCard } from '@/components/PushOptInCard';

describe('PushOptInCard UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligible = true;
    mockPlatform = 'android';
  });

  afterEach(() => {
    cleanup();
  });

  it('transitions from idle to granted and sends a test notification', async () => {
    mockEnablePush.mockResolvedValue('granted');
    mockSendTestPush.mockResolvedValue({ ok: true });

    render(<PushOptInCard finishedPlaysCount={2} />);

    expect(screen.getByTestId('push-opt-in-card')).toBeTruthy();
    expect(screen.getByTestId('push-enable-btn').textContent).toBe('Turn on reminders');

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-enable-btn'));
      await Promise.resolve();
    });

    const granted = screen.getByTestId('push-granted-state');
    expect(granted.getAttribute('role')).toBe('status');
    expect(granted.textContent).toContain('Reminders on');

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-send-test-btn'));
      await Promise.resolve();
    });

    expect(mockSendTestPush).toHaveBeenCalledWith('en');
    expect(screen.getByTestId('push-test-sent-msg').textContent).toContain(
      'Test sent — check your notifications',
    );
  });

  it('shows per-platform blocked help when permission is denied', async () => {
    mockPlatform = 'ios';
    mockEnablePush.mockResolvedValue('denied');

    render(<PushOptInCard finishedPlaysCount={1} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-enable-btn'));
      await Promise.resolve();
    });

    const denied = screen.getByTestId('push-denied-state');
    expect(denied.getAttribute('role')).toBe('status');
    expect(denied.textContent).toContain('Notifications are blocked for RonDuel.');
    expect(denied.textContent).toContain('iPhone: Settings → Notifications');
  });

  it('snoozes card when Not now is clicked and hides when another sheet is open', () => {
    const { rerender } = render(<PushOptInCard finishedPlaysCount={1} anySheetOpen />);
    expect(screen.queryByTestId('push-opt-in-card')).toBeNull();

    rerender(<PushOptInCard finishedPlaysCount={1} anySheetOpen={false} />);
    expect(screen.getByTestId('push-opt-in-card')).toBeTruthy();

    fireEvent.click(screen.getByTestId('push-not-now-btn'));
    expect(mockDismissPushCard).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('push-opt-in-card')).toBeNull();
  });
});
