// @vitest-environment jsdom

import type { Auth } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLocalSession, saveLocalSession } from '@/lib/session';
import {
  checkInactivityExpiry,
  INACTIVITY_EXPIRY_MS,
  LAST_ACTIVE_STORAGE_KEY,
  readLastActive,
} from '@/lib/session-activity';

const DAY_MS = 86_400_000;

function makeMockAuth(user: { uid: string; isAnonymous: boolean; email?: string } | null): Auth {
  return {
    currentUser: user,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  } as unknown as Auth;
}

describe('session-activity 30-day inactivity expiry', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('signs out a real user after 31 days of inactivity and resets local account fields', async () => {
    const now = 1_800_000_000_000;
    window.localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(now - 31 * DAY_MS));
    saveLocalSession({
      uid: 'u_signed_in',
      nickname: 'Andrei',
      ageConfirmed16: true,
      relaxedTimer: false,
      theme: 'dark',
      analyticsConsent: 'accepted',
      email: 'andrei@example.com',
      isAnonymous: false,
      authProvider: 'google.com',
    });

    const logoutFn = vi.fn().mockResolvedValue(undefined);
    const result = await checkInactivityExpiry({
      now,
      getAuthFn: () =>
        makeMockAuth({ uid: 'u_signed_in', isAnonymous: false, email: 'andrei@example.com' }),
      logoutFn,
    });

    expect(result.expired).toBe(true);
    expect(logoutFn).toHaveBeenCalledTimes(1);

    const session = getLocalSession();
    expect(session.isAnonymous).toBe(true);
    expect(session.email).toBeUndefined();
    expect(session.authProvider).toBe('anonymous');
    expect(readLastActive()).toBe(now);
  });

  it('keeps a real user signed in after 29 days of inactivity and refreshes the stamp', async () => {
    const now = 1_800_000_000_000;
    window.localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(now - 29 * DAY_MS));

    const logoutFn = vi.fn().mockResolvedValue(undefined);
    const result = await checkInactivityExpiry({
      now,
      getAuthFn: () =>
        makeMockAuth({ uid: 'u_signed_in', isAnonymous: false, email: 'andrei@example.com' }),
      logoutFn,
    });

    expect(result.expired).toBe(false);
    expect(logoutFn).not.toHaveBeenCalled();
    expect(readLastActive()).toBe(now);
  });

  it('writes a stamp without signing out when no stamp exists yet (existing users)', async () => {
    const now = 1_800_000_000_000;
    expect(readLastActive()).toBeNull();

    const logoutFn = vi.fn().mockResolvedValue(undefined);
    const result = await checkInactivityExpiry({
      now,
      getAuthFn: () =>
        makeMockAuth({ uid: 'u_existing', isAnonymous: false, email: 'existing@example.com' }),
      logoutFn,
    });

    expect(result.expired).toBe(false);
    expect(logoutFn).not.toHaveBeenCalled();
    expect(readLastActive()).toBe(now);
  });

  it('never signs out an anonymous guest even past 30 days', async () => {
    const now = 1_800_000_000_000;
    window.localStorage.setItem(
      LAST_ACTIVE_STORAGE_KEY,
      String(now - INACTIVITY_EXPIRY_MS - 5 * DAY_MS),
    );

    const logoutFn = vi.fn().mockResolvedValue(undefined);
    const result = await checkInactivityExpiry({
      now,
      getAuthFn: () => makeMockAuth({ uid: 'u_guest', isAnonymous: true }),
      logoutFn,
    });

    expect(result.expired).toBe(false);
    expect(logoutFn).not.toHaveBeenCalled();
    expect(readLastActive()).toBe(now);
  });
});
