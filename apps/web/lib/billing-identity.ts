'use client';

import type { Auth, User } from 'firebase/auth';

import { getFirebaseAuth, logoutUser, signInWithCustomTokenSafe } from '@/lib/firebase';
import { getLocalSession, type LocalSession } from '@/lib/session';

export type AlignIdentityResult =
  | { status: 'aligned'; uid: string }
  | { status: 'needs_sign_in'; code?: string }
  | { status: 'error'; code: string };

export interface BillingIdentityOptions {
  getAuthFn?: () => Auth | null;
  fetchFn?: typeof fetch;
  getSessionFn?: () => LocalSession;
  signInCustomTokenFn?: (token: string) => Promise<Pick<User, 'uid'>>;
  signOutFn?: () => Promise<void>;
}

const AUTH_READY_TIMEOUT_MS = 4000;

async function waitForAuthReady(auth: Auth): Promise<void> {
  if (typeof auth.authStateReady !== 'function') return;
  try {
    await Promise.race([
      auth.authStateReady(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, AUTH_READY_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Proceed and inspect currentUser below
  }
}

function getValidSessionUid(session: LocalSession | null | undefined): string {
  const uid = typeof session?.uid === 'string' ? session.uid.trim() : '';
  if (!uid || uid === 'anon' || uid === 'u_ssr') return '';
  return uid;
}

function isRealSession(session: LocalSession | null | undefined): boolean {
  const uid = getValidSessionUid(session);
  if (!uid) return false;
  return session?.isAnonymous === false || Boolean(session?.email);
}

/**
 * Ensures `auth.currentUser.uid` matches the active RonDuel `uid` by exchanging the
 * current Firebase ID token for a server-minted Custom Token via `POST /api/auth/exchange`
 * whenever the UIDs diverge.
 *
 * Security invariants:
 * - Never sends `uid` or `email` in the request body; only `Authorization: Bearer <idToken>`.
 * - Never overwrites the local RonDuel session when the Firebase login resolves to a foreign uid;
 *   signs out Firebase and returns `needs_sign_in` (`ACCOUNT_MISMATCH`) instead.
 * - Never logs tokens.
 */
export async function alignFirebaseIdentity(
  options?: BillingIdentityOptions,
): Promise<AlignIdentityResult> {
  const getAuthFn = options?.getAuthFn ?? getFirebaseAuth;
  const fetchFn = options?.fetchFn ?? (typeof fetch === 'function' ? fetch : undefined);
  const getSessionFn = options?.getSessionFn ?? getLocalSession;
  const signInCustomTokenFn = options?.signInCustomTokenFn ?? signInWithCustomTokenSafe;
  const signOutFn = options?.signOutFn ?? logoutUser;

  const auth = getAuthFn();
  if (!auth) {
    return { status: 'needs_sign_in', code: 'NO_AUTH' };
  }

  await waitForAuthReady(auth);

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { status: 'needs_sign_in', code: 'NO_USER' };
  }

  if (currentUser.isAnonymous) {
    return { status: 'needs_sign_in', code: 'ANONYMOUS' };
  }

  const session = getSessionFn();
  const sessionUid = getValidSessionUid(session);
  const hasRealLocalUid = isRealSession(session);

  if (sessionUid && currentUser.uid === sessionUid) {
    return { status: 'aligned', uid: currentUser.uid };
  }

  if (!fetchFn) {
    return { status: 'error', code: 'FETCH_UNAVAILABLE' };
  }

  let idToken: string | null = null;
  try {
    idToken = await currentUser.getIdToken();
  } catch {
    idToken = null;
  }

  if (!idToken) {
    return { status: 'needs_sign_in', code: 'NO_TOKEN' };
  }

  let res: Response;
  try {
    res = await fetchFn('/api/auth/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: '{}',
    });
  } catch {
    return { status: 'error', code: 'NETWORK_ERROR' };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const code = typeof data.code === 'string' ? data.code : 'EXCHANGE_FAILED';
    if (res.status === 403 && code === 'EMAIL_NOT_VERIFIED') {
      return { status: 'error', code: 'EMAIL_NOT_VERIFIED' };
    }
    if (res.status === 503 || code === 'TOKEN_SIGNING_UNAVAILABLE') {
      return { status: 'error', code: 'TOKEN_SIGNING_UNAVAILABLE' };
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { status: 'needs_sign_in', code };
    }
    return { status: 'error', code };
  }

  const targetUid = typeof data.uid === 'string' ? data.uid.trim() : '';

  // Never overwrite the active RonDuel session with a foreign account
  if (hasRealLocalUid && targetUid && targetUid !== sessionUid) {
    try {
      await signOutFn();
    } catch {
      // ignore sign-out failure
    }
    return { status: 'needs_sign_in', code: 'ACCOUNT_MISMATCH' };
  }

  if (data.aligned === true) {
    const activeUid = auth.currentUser?.uid ?? currentUser.uid;
    if (!hasRealLocalUid || activeUid === sessionUid) {
      return { status: 'aligned', uid: activeUid };
    }
    try {
      await signOutFn();
    } catch {
      // ignore
    }
    return { status: 'needs_sign_in', code: 'ACCOUNT_MISMATCH' };
  }

  const customToken = typeof data.customToken === 'string' ? data.customToken : '';
  if (!customToken) {
    return { status: 'error', code: 'INVALID_EXCHANGE_RESPONSE' };
  }

  try {
    const signedUser = await signInCustomTokenFn(customToken);
    const expectedUid = hasRealLocalUid ? sessionUid : targetUid;
    if (!signedUser?.uid || (expectedUid && signedUser.uid !== expectedUid)) {
      try {
        await signOutFn();
      } catch {
        // ignore
      }
      return { status: 'needs_sign_in', code: 'UID_MISMATCH' };
    }
    return { status: 'aligned', uid: signedUser.uid };
  } catch {
    return { status: 'error', code: 'CUSTOM_TOKEN_SIGN_IN_FAILED' };
  }
}

/**
 * Aligns Firebase Auth identity to the active RonDuel uid and returns a fresh ID token,
 * together with the alignment status/code so callers can distinguish re-auth vs errors.
 */
export async function getBillingIdTokenWithResult(
  options?: BillingIdentityOptions,
): Promise<{ token: string | null; alignment: AlignIdentityResult }> {
  const alignment = await alignFirebaseIdentity(options);
  if (alignment.status !== 'aligned') {
    return { token: null, alignment };
  }

  const getAuthFn = options?.getAuthFn ?? getFirebaseAuth;
  const getSessionFn = options?.getSessionFn ?? getLocalSession;
  const auth = getAuthFn();
  const user = auth?.currentUser;
  const session = getSessionFn();
  const sessionUid = getValidSessionUid(session);

  if (!user || user.isAnonymous || (sessionUid && user.uid !== sessionUid)) {
    return {
      token: null,
      alignment: { status: 'needs_sign_in', code: 'UID_MISMATCH' },
    };
  }

  try {
    const token = await user.getIdToken();
    if (!token) {
      return {
        token: null,
        alignment: { status: 'needs_sign_in', code: 'NO_TOKEN' },
      };
    }
    return { token, alignment };
  } catch {
    return {
      token: null,
      alignment: { status: 'needs_sign_in', code: 'TOKEN_FAILED' },
    };
  }
}

/**
 * Returns a Firebase ID token whose `uid` is guaranteed to match the active RonDuel `uid`,
 * or `null` if the user must sign in / re-confirm their account first.
 */
export async function getBillingIdToken(options?: BillingIdentityOptions): Promise<string | null> {
  const { token } = await getBillingIdTokenWithResult(options);
  return token;
}
