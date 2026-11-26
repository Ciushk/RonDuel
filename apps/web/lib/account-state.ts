'use client';

import type { Auth } from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/firebase';
import { getLocalSession } from '@/lib/session';

const REAL_AUTH_PROVIDERS = new Set(['google.com', 'password']);

export interface HasRealAccountOptions {
  getAuthFn?: () => Auth | null;
}

/**
 * Returns true only when the player has a verified real account (`google.com` or `password`),
 * never for anonymous Firebase guests or legacy unverified `email_link` local sessions.
 */
export async function hasRealAccount(options?: HasRealAccountOptions): Promise<boolean> {
  const getAuthFn = options?.getAuthFn ?? getFirebaseAuth;
  const auth = getAuthFn();

  if (auth) {
    try {
      if (typeof auth.authStateReady === 'function') {
        await Promise.race([
          auth.authStateReady(),
          new Promise<void>((resolve) => {
            setTimeout(resolve, 4000);
          }),
        ]);
      }
    } catch {
      return false;
    }

    const user = auth.currentUser;
    if (!user || user.isAnonymous || !user.email) {
      return false;
    }

    if (Array.isArray(user.providerData) && user.providerData.length > 0) {
      return user.providerData.some((info) =>
        typeof info?.providerId === 'string' ? REAL_AUTH_PROVIDERS.has(info.providerId) : false,
      );
    }

    return true;
  }

  // Fallback only when Firebase Auth is unavailable
  const session = getLocalSession();
  return (
    session.isAnonymous === false &&
    typeof session.authProvider === 'string' &&
    REAL_AUTH_PROVIDERS.has(session.authProvider)
  );
}
