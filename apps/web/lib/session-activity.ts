'use client';

import type { Auth } from 'firebase/auth';

import { anonExpiresAtIso } from '@/lib/anon-retention';
import { getFirebaseAuth, logoutUser } from '@/lib/firebase';
import { getLocalSession, saveLocalSession } from '@/lib/session';

export const LAST_ACTIVE_STORAGE_KEY = 'rd_last_active_at';
export const INACTIVITY_EXPIRY_MS = 30 * 86_400_000; // 30 days
export const ACTIVITY_THROTTLE_MS = 60 * 60_000; // 60 minutes

export interface InactivityCheckOptions {
  now?: number;
  getAuthFn?: () => Auth | null;
  logoutFn?: () => Promise<void>;
}

export interface InactivityCheckResult {
  expired: boolean;
}

export function stampLastActive(now: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(now));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function readLastActive(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Checks whether a signed-in (non-anonymous) user has been inactive for more than 30 days.
 * - Existing users without a stamp yet get stamped and are never signed out.
 * - Anonymous users are never signed out by this check.
 * - Expired signed-in users are signed out and local account fields are reset to a fresh guest.
 */
export async function checkInactivityExpiry(
  options?: InactivityCheckOptions,
): Promise<InactivityCheckResult> {
  if (typeof window === 'undefined') return { expired: false };

  const now = options?.now ?? Date.now();
  const getAuthFn = options?.getAuthFn ?? getFirebaseAuth;
  const logoutFn = options?.logoutFn ?? logoutUser;

  const auth = getAuthFn();
  if (auth && typeof auth.authStateReady === 'function') {
    try {
      await Promise.race([
        auth.authStateReady(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 4000);
        }),
      ]);
    } catch {
      // Fall through to currentUser check
    }
  }

  const lastActive = readLastActive();
  if (lastActive === null) {
    stampLastActive(now);
    return { expired: false };
  }

  const currentUser = auth?.currentUser ?? null;
  if (!currentUser || currentUser.isAnonymous) {
    stampLastActive(now);
    return { expired: false };
  }

  if (now - lastActive > INACTIVITY_EXPIRY_MS) {
    try {
      await logoutFn();
    } catch {
      // Continue clearing local session even if signOut rejects
    }
    const currentSession = getLocalSession();
    const nowIso = new Date(now).toISOString();
    saveLocalSession({
      ...currentSession,
      email: undefined,
      authProvider: 'anonymous',
      isAnonymous: true,
      expiresAt: anonExpiresAtIso(nowIso),
    });
    stampLastActive(now);
    return { expired: true };
  }

  stampLastActive(now);
  return { expired: false };
}

let sharedCheckPromise: Promise<InactivityCheckResult> | null = null;

/**
 * Runs `checkInactivityExpiry()` once per page lifecycle so `AppShell` and
 * `syncSessionWithSignedInUser` share the same result and never race.
 */
export function ensureInactivityCheckOnce(): Promise<InactivityCheckResult> {
  if (!sharedCheckPromise) {
    sharedCheckPromise = checkInactivityExpiry();
  }
  return sharedCheckPromise;
}

export function resetInactivityCheckForTests(): void {
  sharedCheckPromise = null;
}

/**
 * Stamps activity on mount, on tab visibility return, and on the first pointer/key
 * interaction of every hour (passive listeners).
 */
export function startActivityTracker(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let lastInteractionStamp = readLastActive() ?? Date.now();

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      lastInteractionStamp = now;
      stampLastActive(now);
    }
  };

  const onUserInteraction = () => {
    const now = Date.now();
    if (now - lastInteractionStamp >= ACTIVITY_THROTTLE_MS) {
      lastInteractionStamp = now;
      stampLastActive(now);
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pointerdown', onUserInteraction, { passive: true });
  window.addEventListener('keydown', onUserInteraction, { passive: true });

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pointerdown', onUserInteraction);
    window.removeEventListener('keydown', onUserInteraction);
  };
}
