// @vitest-environment jsdom

import type { Auth } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alignFirebaseIdentity,
  getBillingIdToken,
  getBillingIdTokenWithResult,
} from '@/lib/billing-identity';
import type { LocalSession } from '@/lib/session';

function makeSession(overrides?: Partial<LocalSession>): LocalSession {
  return {
    uid: 'u_andrei89',
    nickname: 'Andrei',
    ageConfirmed16: true,
    relaxedTimer: false,
    theme: 'light',
    analyticsConsent: 'rejected',
    email: 'eu.andrei89@gmail.com',
    isAnonymous: false,
    authProvider: 'google.com',
    ...overrides,
  };
}

function makeMockAuth(
  currentUser: {
    uid: string;
    isAnonymous: boolean;
    getIdToken: () => Promise<string>;
  } | null,
): Auth {
  return {
    currentUser,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  } as unknown as Auth;
}

describe('billing-identity (alignFirebaseIdentity & getBillingIdToken)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('returns aligned immediately without calling /api/auth/exchange when uid already matches session', async () => {
    const fetchFn = vi.fn();
    const auth = makeMockAuth({
      uid: 'u_andrei89',
      isAnonymous: false,
      getIdToken: vi.fn().mockResolvedValue('aligned_id_token'),
    });

    const result = await alignFirebaseIdentity({
      getAuthFn: () => auth,
      getSessionFn: () => makeSession(),
      fetchFn,
    });

    expect(result).toEqual({ status: 'aligned', uid: 'u_andrei89' });
    expect(fetchFn).not.toHaveBeenCalled();

    const token = await getBillingIdToken({
      getAuthFn: () => auth,
      getSessionFn: () => makeSession(),
      fetchFn,
    });
    expect(token).toBe('aligned_id_token');
  });

  it('exchanges mismatched Firebase uid via POST /api/auth/exchange and signs in with custom token', async () => {
    const currentUser = {
      uid: 'fb_google_123',
      isAnonymous: false,
      getIdToken: vi.fn().mockResolvedValue('google_id_token'),
    };
    const auth = makeMockAuth(currentUser);
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        customToken: 'custom_jwt_u_andrei89',
        uid: 'u_andrei89',
      }),
    } as unknown as Response);

    const signInCustomTokenFn = vi.fn(async () => {
      // Simulate Firebase updating auth.currentUser to the custom-token uid
      (auth as unknown as { currentUser: typeof currentUser }).currentUser = {
        uid: 'u_andrei89',
        isAnonymous: false,
        getIdToken: vi.fn().mockResolvedValue('custom_aligned_id_token'),
      };
      return { uid: 'u_andrei89' };
    });

    const { token, alignment } = await getBillingIdTokenWithResult({
      getAuthFn: () => auth,
      getSessionFn: () => makeSession(),
      fetchFn,
      signInCustomTokenFn,
    });

    expect(fetchFn).toHaveBeenCalledWith('/api/auth/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer google_id_token',
      },
      body: '{}',
    });
    expect(signInCustomTokenFn).toHaveBeenCalledWith('custom_jwt_u_andrei89');
    expect(alignment).toEqual({ status: 'aligned', uid: 'u_andrei89' });
    expect(token).toBe('custom_aligned_id_token');
  });

  it('returns needs_sign_in when auth.currentUser is null or anonymous', async () => {
    const noUser = await alignFirebaseIdentity({
      getAuthFn: () => makeMockAuth(null),
      getSessionFn: () => makeSession(),
    });
    expect(noUser).toEqual({ status: 'needs_sign_in', code: 'NO_USER' });

    const anonUser = await alignFirebaseIdentity({
      getAuthFn: () =>
        makeMockAuth({
          uid: 'fb_anon',
          isAnonymous: true,
          getIdToken: vi.fn().mockResolvedValue('anon_token'),
        }),
      getSessionFn: () => makeSession(),
    });
    expect(anonUser).toEqual({ status: 'needs_sign_in', code: 'ANONYMOUS' });
  });

  it('returns error EMAIL_NOT_VERIFIED on 403 and TOKEN_SIGNING_UNAVAILABLE on 503', async () => {
    const auth = makeMockAuth({
      uid: 'fb_pw_1',
      isAnonymous: false,
      getIdToken: vi.fn().mockResolvedValue('pw_token'),
    });

    const unverified = await alignFirebaseIdentity({
      getAuthFn: () => auth,
      getSessionFn: () => makeSession(),
      fetchFn: vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ code: 'EMAIL_NOT_VERIFIED' }),
      } as unknown as Response),
    });
    expect(unverified).toEqual({ status: 'error', code: 'EMAIL_NOT_VERIFIED' });

    const unavailable = await alignFirebaseIdentity({
      getAuthFn: () => auth,
      getSessionFn: () => makeSession(),
      fetchFn: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ code: 'TOKEN_SIGNING_UNAVAILABLE' }),
      } as unknown as Response),
    });
    expect(unavailable).toEqual({ status: 'error', code: 'TOKEN_SIGNING_UNAVAILABLE' });
  });

  it('signs out Firebase and returns needs_sign_in (null billing token) if exchange resolves to a foreign uid', async () => {
    const session = makeSession({ uid: 'u_andrei89' });
    window.localStorage.setItem('ronduel_session_v1', JSON.stringify(session));

    const auth = makeMockAuth({
      uid: 'fb_other_person',
      isAnonymous: false,
      getIdToken: vi.fn().mockResolvedValue('other_person_token'),
    });
    const signOutFn = vi.fn().mockResolvedValue(undefined);
    const signInCustomTokenFn = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        customToken: 'custom_jwt_u_foreign',
        uid: 'u_foreign',
      }),
    } as unknown as Response);

    const { token, alignment } = await getBillingIdTokenWithResult({
      getAuthFn: () => auth,
      getSessionFn: () => session,
      fetchFn,
      signInCustomTokenFn,
      signOutFn,
    });

    expect(alignment).toEqual({ status: 'needs_sign_in', code: 'ACCOUNT_MISMATCH' });
    expect(token).toBeNull();
    expect(signOutFn).toHaveBeenCalledTimes(1);
    expect(signInCustomTokenFn).not.toHaveBeenCalled();
    // Active local session must remain untouched
    expect(JSON.parse(window.localStorage.getItem('ronduel_session_v1') || '{}').uid).toBe(
      'u_andrei89',
    );
  });

  it('getBillingIdToken returns null if currentUser.uid still mismatches session.uid after alignment', async () => {
    const auth = makeMockAuth({
      uid: 'fb_mismatch',
      isAnonymous: false,
      getIdToken: vi.fn().mockResolvedValue('bad_token'),
    });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        customToken: 'custom_jwt_u_andrei89',
        uid: 'u_andrei89',
      }),
    } as unknown as Response);

    // signInCustomTokenFn resolves uid u_andrei89, but auth.currentUser was not updated
    const token = await getBillingIdToken({
      getAuthFn: () => auth,
      getSessionFn: () => makeSession({ uid: 'u_andrei89' }),
      fetchFn,
      signInCustomTokenFn: vi.fn().mockResolvedValue({ uid: 'u_andrei89' }),
    });

    expect(token).toBeNull();
  });
});
