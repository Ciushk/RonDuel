'use client';

import { onAuthStateChanged, onIdTokenChanged, type Auth } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { getFirebaseAuth } from '@/lib/firebase';
import { getLocalSession } from '@/lib/session';

const REAL_AUTH_PROVIDERS = new Set(['google.com', 'password']);

export interface AccountUserLike {
  isAnonymous?: boolean | null;
  email?: string | null;
  providerData?: ReadonlyArray<{ providerId?: string | null } | null> | null;
  reload?: () => Promise<void>;
}

export interface RealAccountState {
  ready: boolean;
  isReal: boolean;
}

export interface HasRealAccountOptions {
  getAuthFn?: () => Auth | null;
}

export function normalizeAuthProvider(provider: string | null | undefined): string | null {
  if (typeof provider !== 'string') return null;
  const trimmed = provider.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === 'google' || trimmed === 'google.com') return 'google.com';
  if (trimmed === 'email_password' || trimmed === 'password') return 'password';
  return trimmed;
}

export function isRealAuthProvider(provider: string | null | undefined): boolean {
  const normalized = normalizeAuthProvider(provider);
  return normalized !== null && REAL_AUTH_PROVIDERS.has(normalized);
}

/**
 * Pure check for whether a Firebase Auth user represents a real (non-guest) account:
 * - true whenever `user.isAnonymous === false` (does NOT require `user.email` or a providerData allowlist)
 * - true when `user.isAnonymous === true` (stale flag right after linking) if `providerData`
 *   already contains a real sign-in provider (`google.com` / `password` and their aliases).
 *   Never treats `providerId === 'firebase'` as a real sign-in provider.
 */
export function isRealAccount(user: AccountUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.isAnonymous === false) return true;
  if (Array.isArray(user.providerData)) {
    return user.providerData.some((info) => isRealAuthProvider(info?.providerId));
  }
  return false;
}

function isRealLocalSessionFallback(): boolean {
  const session = getLocalSession();
  return session.isAnonymous === false && isRealAuthProvider(session.authProvider);
}

function subscribeAuthChange(
  auth: Auth,
  listener: (user: AccountUserLike | null) => void,
): (() => void) | null {
  try {
    if (typeof auth.onAuthStateChanged === 'function') {
      return auth.onAuthStateChanged((user) => listener(user));
    }
    return onAuthStateChanged(auth, (user) => listener(user));
  } catch {
    return null;
  }
}

function subscribeIdTokenChange(
  auth: Auth,
  listener: (user: AccountUserLike | null) => void,
): (() => void) | null {
  try {
    if (typeof auth.onIdTokenChanged === 'function') {
      return auth.onIdTokenChanged((user) => listener(user));
    }
    return onIdTokenChanged(auth, (user) => listener(user));
  } catch {
    return null;
  }
}

async function waitForAuthUser(auth: Auth): Promise<AccountUserLike | null> {
  // If an already-hydrated real user is present, avoid waiting further.
  if (isRealAccount(auth.currentUser)) {
    return auth.currentUser;
  }

  if (typeof auth.authStateReady === 'function') {
    try {
      await auth.authStateReady();
      return auth.currentUser;
    } catch {
      // authStateReady failed — do NOT blindly treat as guest; fall back to currentUser / onAuthStateChanged.
      if (auth.currentUser) {
        return auth.currentUser;
      }
      return await new Promise<AccountUserLike | null>((resolve) => {
        let settled = false;
        let unsub: (() => void) | null = null;
        const finish = (user: AccountUserLike | null) => {
          if (settled) return;
          settled = true;
          try {
            unsub?.();
          } catch {
            // ignore
          }
          resolve(user);
        };
        unsub = subscribeAuthChange(auth, finish);
        if (!unsub) {
          finish(auth.currentUser);
        }
      });
    }
  }

  // Fallback for auth objects without authStateReady
  if (auth.currentUser) {
    return auth.currentUser;
  }
  return await new Promise<AccountUserLike | null>((resolve) => {
    let settled = false;
    let unsub: (() => void) | null = null;
    const finish = (user: AccountUserLike | null) => {
      if (settled) return;
      settled = true;
      try {
        unsub?.();
      } catch {
        // ignore
      }
      resolve(user);
    };
    unsub = subscribeAuthChange(auth, finish);
    if (!unsub) {
      finish(auth.currentUser);
    }
  });
}

async function evaluateUserWithOptionalReload(
  auth: Auth,
  user: AccountUserLike | null,
): Promise<boolean> {
  if (!user) return false;

  if (isRealAccount(user)) {
    // Best-effort background refresh if Firebase still reports stale isAnonymous === true after link
    if (user.isAnonymous === true && typeof user.reload === 'function') {
      void user.reload().catch(() => {});
    }
    return true;
  }

  // Rare post-link window where email is populated while isAnonymous is still true and providerData hasn't updated yet
  if (
    user.isAnonymous === true &&
    typeof user.email === 'string' &&
    user.email.trim().length > 0 &&
    typeof user.reload === 'function'
  ) {
    try {
      await user.reload();
    } catch {
      // ignore reload network failure
    }
    return isRealAccount(auth.currentUser ?? user);
  }

  return false;
}

/**
 * Single source of truth for whether the current player has a real (non-guest) account.
 * Awaits Firebase Auth readiness without treating slow/loading hydration as guest.
 * Falls back to normalized LocalSession only when Firebase Auth is unavailable (`getFirebaseAuth() === null`).
 */
export async function hasRealAccount(options?: HasRealAccountOptions): Promise<boolean> {
  const getAuthFn = options?.getAuthFn ?? getFirebaseAuth;
  const auth = getAuthFn();

  if (auth) {
    const user = await waitForAuthUser(auth);
    return evaluateUserWithOptionalReload(auth, user);
  }

  // Fallback only when Firebase Auth is unavailable
  return isRealLocalSessionFallback();
}

/**
 * Client hook tracking Firebase Auth readiness and real-account status.
 * Keeps `ready: false` while persistence is hydrating so callers never mistake loading for guest.
 */
export function useIsRealAccount(options?: HasRealAccountOptions): RealAccountState {
  const getAuthFn = options?.getAuthFn ?? getFirebaseAuth;
  const [state, setState] = useState<RealAccountState>({ ready: false, isReal: false });

  useEffect(() => {
    let active = true;
    const auth = getAuthFn();

    if (!auth) {
      const syncLocal = () => {
        if (!active) return;
        const nextReal = isRealLocalSessionFallback();
        setState((prev) =>
          prev.ready && prev.isReal === nextReal ? prev : { ready: true, isReal: nextReal },
        );
      };
      syncLocal();
      if (typeof window !== 'undefined') {
        window.addEventListener('ronduel_session_updated', syncLocal);
      }
      return () => {
        active = false;
        if (typeof window !== 'undefined') {
          window.removeEventListener('ronduel_session_updated', syncLocal);
        }
      };
    }

    const hasReadyPromise = typeof auth.authStateReady === 'function';
    let authReadySettled = !hasReadyPromise;
    let authReadyFailed = false;
    let sawCallbackUser = false;
    let lastCallbackUser: AccountUserLike | null = null;

    const commit = (user: AccountUserLike | null, forceReady = false) => {
      if (!active) return;
      const real = isRealAccount(user);
      if (real || forceReady) {
        authReadySettled = true;
      }
      const nextReady = authReadySettled;
      setState((prev) =>
        prev.ready === nextReady && prev.isReal === real
          ? prev
          : { ready: nextReady, isReal: real },
      );
    };

    if (isRealAccount(auth.currentUser)) {
      commit(auth.currentUser, true);
    }

    const handleUserUpdate = (user: AccountUserLike | null) => {
      sawCallbackUser = true;
      lastCallbackUser = user;
      if (authReadySettled || authReadyFailed || isRealAccount(user)) {
        commit(user, true);
      }
    };

    const unsubAuth = subscribeAuthChange(auth, handleUserUpdate);
    const unsubToken = subscribeIdTokenChange(auth, (user) => {
      if (authReadySettled || isRealAccount(user)) {
        commit(user, authReadySettled || isRealAccount(user));
      }
    });

    if (hasReadyPromise) {
      void auth
        .authStateReady()
        .then(() => {
          commit(auth.currentUser, true);
        })
        .catch(() => {
          authReadyFailed = true;
          if (auth.currentUser) {
            commit(auth.currentUser, true);
          } else if (sawCallbackUser) {
            commit(lastCallbackUser, true);
          } else if (!unsubAuth) {
            commit(auth.currentUser, true);
          }
        });
    } else if (!unsubAuth) {
      commit(auth.currentUser, true);
    }

    const onSessionUpdated = () => {
      if (!active) return;
      if (authReadySettled || isRealAccount(auth.currentUser)) {
        commit(auth.currentUser, authReadySettled || isRealAccount(auth.currentUser));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ronduel_session_updated', onSessionUpdated);
    }

    return () => {
      active = false;
      try {
        unsubAuth?.();
      } catch {
        // ignore
      }
      try {
        unsubToken?.();
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('ronduel_session_updated', onSessionUpdated);
      }
    };
  }, [getAuthFn]);

  return state;
}
