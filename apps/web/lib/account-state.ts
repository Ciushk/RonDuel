'use client';

import { onAuthStateChanged, onIdTokenChanged, type Auth } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { getFirebaseAuth } from '@/lib/firebase';
import { getLocalSession } from '@/lib/session';

const REAL_AUTH_PROVIDERS = new Set(['google.com', 'password', 'email_link']);
const SERVER_CONFIRM_TTL_MS = 10 * 60 * 1000;
const SERVER_CONFIRM_TIMEOUT_MS = 4000;

interface ServerConfirmCacheEntry {
  email: string;
  expiresAt: number;
}

const serverConfirmCache = new Map<string, ServerConfirmCacheEntry>();
const inFlightServerConfirms = new Map<string, Promise<boolean>>();

export interface AccountUserLike {
  isAnonymous?: boolean | null;
  email?: string | null;
  providerData?: ReadonlyArray<{ providerId?: string | null } | null> | null;
  reload?: () => Promise<void>;
}

export interface LocalSessionAccountLike {
  uid?: string | null;
  isAnonymous?: boolean | null;
  email?: string | null;
  authProvider?: string | null;
}

export interface RealAccountState {
  ready: boolean;
  isReal: boolean;
}

export interface ConfirmServerAccountOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
}

export interface HasRealAccountOptions extends ConfirmServerAccountOptions {
  getAuthFn?: () => Auth | null;
}

export function clearServerAccountCache(): void {
  serverConfirmCache.clear();
  inFlightServerConfirms.clear();
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
 *   already contains a real sign-in provider (`google.com`, `password`, `email_link` and aliases).
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

/**
 * Pure check for whether a stored local RonDuel session looks like a real (non-guest) account.
 * Must still be confirmed against the server via `confirmServerAccount` before bypassing the gate.
 */
export function isRealLocalSession(session: LocalSessionAccountLike | null | undefined): boolean {
  if (!session) return false;
  if (session.isAnonymous !== false) return false;
  const uid = typeof session.uid === 'string' ? session.uid.trim() : '';
  if (!uid || uid === 'anon' || uid === 'u_ssr') return false;
  const email = typeof session.email === 'string' ? session.email.trim() : '';
  if (!email) return false;
  return isRealAuthProvider(session.authProvider);
}

function getCachedServerConfirmation(uid: string, email: string, nowMs: number): boolean {
  const cleanUid = uid.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanUid || !cleanEmail) return false;
  const cached = serverConfirmCache.get(cleanUid);
  if (!cached) return false;
  if (cached.expiresAt <= nowMs) {
    serverConfirmCache.delete(cleanUid);
    return false;
  }
  return cached.email === cleanEmail;
}

/**
 * Confirms against `/api/me/profile?uid=...` that a RonDuel account exists as non-anonymous
 * with a matching email. Caches positive responses in memory per `uid` for 10 minutes;
 * negative responses and network/timeout errors are never cached and return `false`.
 */
export async function confirmServerAccount(
  uid: string,
  email: string,
  options?: ConfirmServerAccountOptions,
): Promise<boolean> {
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!cleanUid || !cleanEmail || cleanUid === 'anon' || cleanUid === 'u_ssr') {
    return false;
  }

  const now = options?.nowMs ?? Date.now();
  if (getCachedServerConfirmation(cleanUid, cleanEmail, now)) {
    return true;
  }

  const fetchImpl = options?.fetchFn ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) {
    return false;
  }

  const inflightKey = `${cleanUid}::${cleanEmail}`;
  const existingInflight = inFlightServerConfirms.get(inflightKey);
  if (existingInflight) {
    return existingInflight;
  }

  const timeoutMs = options?.timeoutMs ?? SERVER_CONFIRM_TIMEOUT_MS;

  const task = (async (): Promise<boolean> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timerId = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          // ignore
        }
        reject(new Error('SERVER_ACCOUNT_CONFIRM_TIMEOUT'));
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([
        fetchImpl(`/api/me/profile?uid=${encodeURIComponent(cleanUid)}`, {
          method: 'GET',
          signal: controller?.signal,
        }),
        timeoutPromise,
      ]);

      if (!response || !response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        isAnonymous?: unknown;
        email?: unknown;
      };
      const serverEmail = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
      const confirmed = data?.isAnonymous === false && serverEmail === cleanEmail;

      if (confirmed) {
        serverConfirmCache.set(cleanUid, {
          email: cleanEmail,
          expiresAt: (options?.nowMs ?? Date.now()) + SERVER_CONFIRM_TTL_MS,
        });
      }

      return confirmed;
    } catch {
      return false;
    } finally {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      inFlightServerConfirms.delete(inflightKey);
    }
  })();

  inFlightServerConfirms.set(inflightKey, task);
  return task;
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
 * Single source of truth for whether the current player has a real (non-guest) account:
 * 1. Real Firebase Auth user -> true.
 * 2. Otherwise, if local RonDuel session looks real and is confirmed by `/api/me/profile` -> true.
 * 3. Otherwise -> false (guest).
 */
export async function hasRealAccount(options?: HasRealAccountOptions): Promise<boolean> {
  const getAuthFn = options?.getAuthFn ?? getFirebaseAuth;
  const auth = getAuthFn();

  if (auth) {
    const user = await waitForAuthUser(auth);
    const firebaseReal = await evaluateUserWithOptionalReload(auth, user);
    if (firebaseReal) {
      return true;
    }
  }

  const session = getLocalSession();
  if (!isRealLocalSession(session)) {
    return false;
  }

  return confirmServerAccount(session.uid, session.email!, {
    fetchFn: options?.fetchFn,
    timeoutMs: options?.timeoutMs,
    nowMs: options?.nowMs,
  });
}

/**
 * Client hook tracking Firebase Auth + server-confirmed RonDuel account readiness.
 * Keeps `ready: false` while Firebase Auth OR server confirmation is pending so callers
 * never flash the payment gate for a real account.
 */
export function useIsRealAccount(options?: HasRealAccountOptions): RealAccountState {
  const getAuthFnRef = { current: options?.getAuthFn ?? getFirebaseAuth };
  const fetchFnRef = { current: options?.fetchFn };
  const timeoutMsRef = { current: options?.timeoutMs };
  const [state, setState] = useState<RealAccountState>({ ready: false, isReal: false });

  useEffect(() => {
    let active = true;
    let checkGen = 0;
    let readingLocalSession = false;
    const auth = getAuthFnRef.current();

    const commitState = (nextReady: boolean, nextReal: boolean) => {
      if (!active) return;
      setState((prev) =>
        prev.ready === nextReady && prev.isReal === nextReal
          ? prev
          : { ready: nextReady, isReal: nextReal },
      );
    };

    const readSessionSafely = (
      overrideSession?: LocalSessionAccountLike | null,
    ): LocalSessionAccountLike | null => {
      if (overrideSession) return overrideSession;
      readingLocalSession = true;
      try {
        return getLocalSession();
      } finally {
        readingLocalSession = false;
      }
    };

    const resolveViaLocalSession = (overrideSession?: LocalSessionAccountLike | null) => {
      checkGen += 1;
      const gen = checkGen;
      const session = readSessionSafely(overrideSession);

      if (!isRealLocalSession(session)) {
        commitState(true, false);
        return;
      }

      const uid = session!.uid!.trim();
      const email = session!.email!.trim();

      if (getCachedServerConfirmation(uid, email, Date.now())) {
        commitState(true, true);
        return;
      }

      // Keep ready=false while server confirmation is in flight so callers never flash guest UI.
      commitState(false, false);

      void confirmServerAccount(uid, email, {
        fetchFn: fetchFnRef.current,
        timeoutMs: timeoutMsRef.current,
      }).then((confirmed) => {
        if (!active || gen !== checkGen) return;
        commitState(true, confirmed);
      });
    };

    if (!auth) {
      resolveViaLocalSession();
      const onSessionUpdated = (event: Event) => {
        if (!active || readingLocalSession) return;
        const detail = (event as CustomEvent<LocalSessionAccountLike | undefined>).detail;
        resolveViaLocalSession(detail ?? null);
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('ronduel_session_updated', onSessionUpdated);
      }
      return () => {
        active = false;
        checkGen += 1;
        if (typeof window !== 'undefined') {
          window.removeEventListener('ronduel_session_updated', onSessionUpdated);
        }
      };
    }

    const hasReadyPromise = typeof auth.authStateReady === 'function';
    let authReadySettled = !hasReadyPromise;
    let authReadyFailed = false;
    let sawCallbackUser = false;
    let lastCallbackUser: AccountUserLike | null = null;

    const commit = (
      user: AccountUserLike | null,
      forceReady = false,
      overrideSession?: LocalSessionAccountLike | null,
    ) => {
      if (!active) return;
      const real = isRealAccount(user);
      if (real) {
        checkGen += 1;
        authReadySettled = true;
        commitState(true, true);
        return;
      }
      if (forceReady) {
        authReadySettled = true;
      }
      if (!authReadySettled) {
        commitState(false, false);
        return;
      }
      resolveViaLocalSession(overrideSession);
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

    const onSessionUpdated = (event: Event) => {
      if (!active || readingLocalSession) return;
      const detail = (event as CustomEvent<LocalSessionAccountLike | undefined>).detail;
      if (authReadySettled || isRealAccount(auth.currentUser)) {
        commit(
          auth.currentUser,
          authReadySettled || isRealAccount(auth.currentUser),
          detail ?? null,
        );
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ronduel_session_updated', onSessionUpdated);
    }

    return () => {
      active = false;
      checkGen += 1;
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
    // Mount-scoped subscription to Firebase Auth + local session events
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
