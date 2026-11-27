// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Auth } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearServerAccountCache,
  confirmServerAccount,
  hasRealAccount,
  isRealAccount,
  isRealLocalSession,
  normalizeAuthProvider,
  useIsRealAccount,
  type AccountUserLike,
} from '@/lib/account-state';
import { saveLocalSession } from '@/lib/session';

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createMockAuth(opts: {
  currentUser?: AccountUserLike | null;
  authStateReady?: () => Promise<void>;
  withListeners?: boolean;
}) {
  const authListeners = new Set<(user: AccountUserLike | null) => void>();
  const tokenListeners = new Set<(user: AccountUserLike | null) => void>();
  const mockAuth = {
    currentUser: opts.currentUser ?? null,
    authStateReady: opts.authStateReady ?? (() => Promise.resolve()),
    ...(opts.withListeners !== false
      ? {
          onAuthStateChanged: (cb: (user: AccountUserLike | null) => void) => {
            authListeners.add(cb);
            return () => {
              authListeners.delete(cb);
            };
          },
          onIdTokenChanged: (cb: (user: AccountUserLike | null) => void) => {
            tokenListeners.add(cb);
            return () => {
              tokenListeners.delete(cb);
            };
          },
        }
      : {}),
  };

  return {
    auth: mockAuth as unknown as Auth,
    setUser(user: AccountUserLike | null) {
      mockAuth.currentUser = user;
    },
    emitAuth(user: AccountUserLike | null) {
      mockAuth.currentUser = user;
      for (const cb of authListeners) cb(user);
    },
    emitToken(user: AccountUserLike | null) {
      mockAuth.currentUser = user;
      for (const cb of tokenListeners) cb(user);
    },
  };
}

describe('account-state (single source of truth)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearServerAccountCache();
  });

  afterEach(() => {
    cleanup();
    clearServerAccountCache();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('normalizeAuthProvider & isRealAccount (pure)', () => {
    it('normalizes Google and email/password provider aliases', () => {
      expect(normalizeAuthProvider('google')).toBe('google.com');
      expect(normalizeAuthProvider('google.com')).toBe('google.com');
      expect(normalizeAuthProvider('email_password')).toBe('password');
      expect(normalizeAuthProvider('password')).toBe('password');
      expect(normalizeAuthProvider('email_link')).toBe('email_link');
      expect(normalizeAuthProvider('firebase')).toBe('firebase');
      expect(normalizeAuthProvider(null)).toBeNull();
    });

    it('returns true for non-anonymous users with or without email and regardless of providerData', () => {
      // Standard google.com & password users
      expect(
        isRealAccount({
          isAnonymous: false,
          email: 'andrei@example.com',
          providerData: [{ providerId: 'google.com' }],
        }),
      ).toBe(true);
      expect(
        isRealAccount({
          isAnonymous: false,
          email: 'andrei@example.com',
          providerData: [{ providerId: 'password' }],
        }),
      ).toBe(true);

      // Missing user.email (email only on providerData or null)
      expect(
        isRealAccount({
          isAnonymous: false,
          email: null,
          providerData: [{ providerId: 'google.com' }],
        }),
      ).toBe(true);
      expect(
        isRealAccount({
          isAnonymous: false,
          email: '',
          providerData: [],
        }),
      ).toBe(true);

      // Non-anonymous with empty or non-allowlisted providerData
      expect(isRealAccount({ isAnonymous: false, providerData: [] })).toBe(true);
      expect(
        isRealAccount({ isAnonymous: false, providerData: [{ providerId: 'apple.com' }] }),
      ).toBe(true);
    });

    it('returns true when isAnonymous is stale true after linking but providerData has a real provider', () => {
      expect(
        isRealAccount({
          isAnonymous: true,
          email: null,
          providerData: [{ providerId: 'google.com' }],
        }),
      ).toBe(true);
      expect(
        isRealAccount({
          isAnonymous: true,
          email: null,
          providerData: [{ providerId: 'password' }],
        }),
      ).toBe(true);
      expect(
        isRealAccount({
          isAnonymous: true,
          providerData: [{ providerId: 'google' }],
        }),
      ).toBe(true);
    });

    it('returns false for anonymous guests and never treats providerId="firebase" as real login', () => {
      expect(isRealAccount(null)).toBe(false);
      expect(isRealAccount(undefined)).toBe(false);
      expect(isRealAccount({ isAnonymous: true, email: null, providerData: [] })).toBe(false);
      expect(
        isRealAccount({
          isAnonymous: true,
          email: null,
          providerData: [{ providerId: 'firebase' }],
        }),
      ).toBe(false);
      expect(
        isRealAccount({
          isAnonymous: true,
          email: null,
          providerData: [{ providerId: 'anonymous' }],
        }),
      ).toBe(false);
    });
  });

  describe('hasRealAccount (async)', () => {
    it('awaits authStateReady and resolves true for real, no-email, empty-providerData, and stale-linked users', async () => {
      const cases: AccountUserLike[] = [
        { isAnonymous: false, email: 'a@b.com', providerData: [{ providerId: 'google.com' }] },
        { isAnonymous: false, email: null, providerData: [{ providerId: 'google.com' }] },
        { isAnonymous: false, email: null, providerData: [] },
        { isAnonymous: true, email: null, providerData: [{ providerId: 'password' }] },
      ];

      for (const user of cases) {
        const ready = createDeferred();
        const mock = createMockAuth({ currentUser: null, authStateReady: () => ready.promise });

        const checkPromise = hasRealAccount({ getAuthFn: () => mock.auth });
        mock.setUser(user);
        ready.resolve();

        await expect(checkPromise).resolves.toBe(true);
      }
    });

    it('does not blindly return false when authStateReady rejects; falls back to currentUser / onAuthStateChanged', async () => {
      const mock = createMockAuth({
        currentUser: null,
        authStateReady: () => Promise.reject(new Error('idb error')),
      });

      const checkPromise = hasRealAccount({ getAuthFn: () => mock.auth });
      await Promise.resolve();
      mock.emitAuth({
        isAnonymous: false,
        email: 'recovered@example.com',
        providerData: [{ providerId: 'google.com' }],
      });

      await expect(checkPromise).resolves.toBe(true);
    });

    it('returns true when Firebase currentUser is null but local RonDuel session is confirmed by /api/me/profile', async () => {
      const mock = createMockAuth({ currentUser: null });
      saveLocalSession({
        uid: 'u_andrei89',
        nickname: 'Andrei',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
        email: 'EU.Andrei89@gmail.com',
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

      await expect(
        hasRealAccount({ getAuthFn: () => mock.auth, fetchFn: fetchMock }),
      ).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/me/profile?uid=u_andrei89',
        expect.objectContaining({ method: 'GET' }),
      );

      // Positive confirmation is cached per uid for 10 min (no duplicate fetch)
      await expect(
        hasRealAccount({ getAuthFn: () => mock.auth, fetchFn: fetchMock }),
      ).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns false (and does not cache) when /api/me/profile returns isAnonymous=true or a different email', async () => {
      const mock = createMockAuth({ currentUser: null });
      saveLocalSession({
        uid: 'u_mismatch',
        nickname: 'Player',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
        email: 'player@example.com',
        isAnonymous: false,
        authProvider: 'google',
      });

      const anonFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isAnonymous: true, email: 'player@example.com' }),
      });
      await expect(
        hasRealAccount({ getAuthFn: () => mock.auth, fetchFn: anonFetch }),
      ).resolves.toBe(false);

      const wrongEmailFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isAnonymous: false, email: 'other@example.com' }),
      });
      await expect(
        hasRealAccount({ getAuthFn: () => mock.auth, fetchFn: wrongEmailFetch }),
      ).resolves.toBe(false);

      // Negative results are NOT cached, so a subsequent valid response still succeeds
      const validFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isAnonymous: false, email: 'player@example.com' }),
      });
      await expect(
        hasRealAccount({ getAuthFn: () => mock.auth, fetchFn: validFetch }),
      ).resolves.toBe(true);
    });

    it('returns false without firing any fetch for anonymous local sessions', async () => {
      const mock = createMockAuth({ currentUser: null });
      saveLocalSession({
        uid: 'u_guest_1',
        nickname: 'Guest',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
        isAnonymous: true,
        authProvider: 'anonymous',
      });

      const fetchMock = vi.fn();
      await expect(
        hasRealAccount({ getAuthFn: () => mock.auth, fetchFn: fetchMock }),
      ).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns false on network error or timeout (4s) without caching', async () => {
      const mock = createMockAuth({ currentUser: null });
      saveLocalSession({
        uid: 'u_net_err',
        nickname: 'Player',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
        email: 'player@example.com',
        isAnonymous: false,
        authProvider: 'google',
      });

      const failingFetch = vi.fn().mockRejectedValue(new Error('network down'));
      await expect(
        hasRealAccount({ getAuthFn: () => mock.auth, fetchFn: failingFetch }),
      ).resolves.toBe(false);

      // Timeout test
      const hangingFetch = vi.fn(
        () =>
          new Promise<Response>(() => {
            // never resolves
          }),
      );
      await expect(
        confirmServerAccount('u_net_err', 'player@example.com', {
          fetchFn: hangingFetch,
          timeoutMs: 25,
        }),
      ).resolves.toBe(false);
    });

    it('treats google, google.com, password, email_password, and email_link as real local providers, and rejects anonymous / anon / u_ssr', async () => {
      const base = {
        uid: 'u_fallback',
        nickname: 'Player',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light' as const,
        analyticsConsent: 'rejected' as const,
        email: 'player@example.com',
        isAnonymous: false,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isAnonymous: false, email: 'player@example.com' }),
      });

      for (const provider of [
        'google',
        'google.com',
        'password',
        'email_password',
        'email_link',
      ] as const) {
        clearServerAccountCache();
        expect(isRealLocalSession({ ...base, authProvider: provider })).toBe(true);
        saveLocalSession({ ...base, authProvider: provider });
        await expect(hasRealAccount({ getAuthFn: () => null, fetchFn: fetchMock })).resolves.toBe(
          true,
        );
      }

      expect(isRealLocalSession({ ...base, authProvider: 'anonymous' })).toBe(false);
      expect(isRealLocalSession({ ...base, uid: 'anon', authProvider: 'google' })).toBe(false);
      expect(isRealLocalSession({ ...base, uid: 'u_ssr', authProvider: 'google' })).toBe(false);
      expect(isRealLocalSession({ ...base, email: '', authProvider: 'google' })).toBe(false);

      saveLocalSession({ ...base, authProvider: 'anonymous' });
      const noFetch = vi.fn();
      await expect(hasRealAccount({ getAuthFn: () => null, fetchFn: noFetch })).resolves.toBe(
        false,
      );
      expect(noFetch).not.toHaveBeenCalled();
    });
  });

  describe('useIsRealAccount hook', () => {
    it('stays ready=false while authStateReady is pending, then resolves ready=true with real/guest state', async () => {
      const ready = createDeferred();
      const mock = createMockAuth({
        currentUser: null,
        authStateReady: () => ready.promise,
      });

      const { result } = renderHook(() => useIsRealAccount({ getAuthFn: () => mock.auth }));
      expect(result.current).toEqual({ ready: false, isReal: false });

      // Early null onAuthStateChanged callback before authStateReady settles must NOT flip ready=true
      act(() => {
        mock.emitAuth(null);
      });
      expect(result.current).toEqual({ ready: false, isReal: false });

      // Once authStateReady resolves with a real user, hook becomes ready=true, isReal=true
      act(() => {
        mock.setUser({
          isAnonymous: false,
          email: null,
          providerData: [{ providerId: 'google.com' }],
        });
        ready.resolve();
      });

      await waitFor(() => {
        expect(result.current).toEqual({ ready: true, isReal: true });
      });
    });

    it('resolves ready=true, isReal=false only after authStateReady settles for an anonymous guest', async () => {
      const ready = createDeferred();
      const mock = createMockAuth({
        currentUser: null,
        authStateReady: () => ready.promise,
      });

      const { result } = renderHook(() => useIsRealAccount({ getAuthFn: () => mock.auth }));
      expect(result.current.ready).toBe(false);

      act(() => {
        mock.setUser({ isAnonymous: true, email: null, providerData: [] });
        ready.resolve();
      });

      await waitFor(() => {
        expect(result.current).toEqual({ ready: true, isReal: false });
      });
    });

    it('never flashes ready=true, isReal=false while confirming a real local session against /api/me/profile', async () => {
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

      const serverDeferred = createDeferred<Response>();
      const fetchMock = vi.fn(() => serverDeferred.promise);
      const mock = createMockAuth({
        currentUser: null,
        authStateReady: () => Promise.resolve(),
      });

      const observed: Array<{ ready: boolean; isReal: boolean }> = [];
      const { result } = renderHook(() => {
        const state = useIsRealAccount({ getAuthFn: () => mock.auth, fetchFn: fetchMock });
        observed.push(state);
        return state;
      });

      // Wait until /api/me/profile has been requested
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      // Must STILL be ready=false (never ready=true, isReal=false!) while fetch is pending
      expect(result.current).toEqual({ ready: false, isReal: false });
      expect(observed.some((s) => s.ready && !s.isReal)).toBe(false);

      // Resolve server confirmation
      await act(async () => {
        serverDeferred.resolve({
          ok: true,
          json: async () => ({
            uid: 'u_andrei89',
            isAnonymous: false,
            email: 'eu.andrei89@gmail.com',
          }),
        } as unknown as Response);
        await serverDeferred.promise;
      });

      await waitFor(() => {
        expect(result.current).toEqual({ ready: true, isReal: true });
      });
      expect(observed.some((s) => s.ready && !s.isReal)).toBe(false);
    });
  });
});
