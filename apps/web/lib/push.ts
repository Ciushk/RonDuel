'use client';

import { signInAnonymously } from 'firebase/auth';

import { getFirebaseApp, getFirebaseAuth } from '@/lib/firebase';
import { iosVersion, isAndroid, isIOS, isStandalone } from '@/lib/pwa-env';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';
export type PushEnableOutcome = 'granted' | 'denied' | 'default' | 'unsupported' | 'error';
export type PushPlatform = 'android' | 'ios' | 'desktop';

export const PUSH_TOKEN_STORAGE_KEY = 'rd_push_token';
export const PUSH_CARD_STORAGE_KEY = 'rd_push_card';
export const PUSH_CARD_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
export const PUSH_CARD_MAX_DISMISSALS = 2;

export interface PushCardState {
  dismissCount: number;
  snoozeUntil: number | null;
}

let warnedMissingVapid = false;

export function getVapidKey(): string {
  const key = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();
  if (!key && !warnedMissingVapid) {
    warnedMissingVapid = true;
    if (typeof console !== 'undefined') {
      console.warn(
        '[RonDuel push] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not configured; push opt-in UI is hidden.',
      );
    }
  }
  return key;
}

export function hasVapidKey(): boolean {
  return getVapidKey().length > 0;
}

export function getPushPlatform(): PushPlatform {
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  return 'desktop';
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return false;
  }
  if (isIOS()) {
    const ver = iosVersion();
    return isStandalone() && ver !== null && ver >= 16.4;
  }
  return true;
}

export function getPermission(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported';
  const perm = window.Notification.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') return perm;
  return 'unsupported';
}

export function readPushCardState(): PushCardState {
  if (typeof window === 'undefined') return { dismissCount: 0, snoozeUntil: null };
  try {
    const raw = window.localStorage.getItem(PUSH_CARD_STORAGE_KEY);
    if (!raw) return { dismissCount: 0, snoozeUntil: null };
    const parsed = JSON.parse(raw) as Partial<PushCardState>;
    return {
      dismissCount: typeof parsed.dismissCount === 'number' ? parsed.dismissCount : 0,
      snoozeUntil: typeof parsed.snoozeUntil === 'number' ? parsed.snoozeUntil : null,
    };
  } catch {
    return { dismissCount: 0, snoozeUntil: null };
  }
}

export function dismissPushCard(now: number = Date.now()): PushCardState {
  const cur = readPushCardState();
  const next: PushCardState = {
    dismissCount: cur.dismissCount + 1,
    snoozeUntil: now + PUSH_CARD_SNOOZE_MS,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PUSH_CARD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write errors
    }
  }
  return next;
}

export function shouldShowPushOptInCard(opts: {
  finishedPlaysCount: number;
  anySheetOpen?: boolean;
  now?: number;
}): boolean {
  if (opts.anySheetOpen) return false;
  if (opts.finishedPlaysCount < 1) return false;
  if (!isPushSupported()) return false;
  if (getPermission() !== 'default') return false;
  if (!hasVapidKey()) return false;

  const state = readPushCardState();
  if (state.dismissCount >= PUSH_CARD_MAX_DISMISSALS) return false;
  const now = opts.now ?? Date.now();
  if (state.snoozeUntil !== null && now < state.snoozeUntil) return false;
  return true;
}

export async function getBearerIdToken(): Promise<{ idToken: string; uid: string } | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  let user = auth.currentUser;
  if (!user) {
    try {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    } catch {
      return null;
    }
  }
  try {
    const idToken = await user.getIdToken();
    return { idToken, uid: user.uid };
  } catch {
    return null;
  }
}

async function syncPushPref(opts: {
  uid: string;
  idToken: string;
  pushEnabled: boolean;
  emailEnabled?: boolean;
  reminderLocalTime?: string;
}): Promise<void> {
  await fetch('/api/notify/prefs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.idToken}`,
    },
    body: JSON.stringify({
      uid: opts.uid,
      pushEnabled: opts.pushEnabled,
      emailEnabled: Boolean(opts.emailEnabled),
      reminderLocalTime: opts.reminderLocalTime ?? '18:00',
    }),
  });
}

export interface EnablePushOptions {
  locale?: string;
  uid?: string;
  emailEnabled?: boolean;
  reminderLocalTime?: string;
}

/**
 * Enables web push notifications.
 * IMPORTANT: `Notification.requestPermission()` is called as the VERY FIRST statement
 * with zero awaits before it so iOS/Safari recognizes the user gesture.
 */
export async function enablePush(opts: EnablePushOptions = {}): Promise<PushEnableOutcome> {
  if (!isPushSupported()) return 'unsupported';

  // Must be the very first async call directly from the user click handler (iOS requirement)
  const permission = await window.Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'default';

  const vapidKey = getVapidKey();
  if (!vapidKey) return 'error';

  try {
    const reg = await navigator.serviceWorker.ready;
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    if (!(await isSupported())) return 'unsupported';

    const app = getFirebaseApp();
    if (!app) return 'error';

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });
    if (!token) return 'error';

    const authInfo = await getBearerIdToken();
    if (!authInfo) return 'error';

    const locale = opts.locale || document.documentElement.lang || 'en';
    const tokenRes = await fetch('/api/notify/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authInfo.idToken}`,
      },
      body: JSON.stringify({
        token,
        platform: getPushPlatform(),
        locale,
      }),
    });
    if (!tokenRes.ok) return 'error';

    try {
      window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore storage write errors
    }

    await syncPushPref({
      uid: authInfo.uid,
      idToken: authInfo.idToken,
      pushEnabled: true,
      emailEnabled: opts.emailEnabled,
      reminderLocalTime: opts.reminderLocalTime,
    });

    return 'granted';
  } catch {
    return 'error';
  }
}

export async function disablePush(
  opts: {
    uid?: string;
    emailEnabled?: boolean;
    reminderLocalTime?: string;
  } = {},
): Promise<boolean> {
  let storedToken: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      storedToken = window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    } catch {
      storedToken = null;
    }
  }

  try {
    if (isPushSupported()) {
      const { isSupported, getMessaging, deleteToken } = await import('firebase/messaging');
      if (await isSupported()) {
        const app = getFirebaseApp();
        if (app) {
          const messaging = getMessaging(app);
          await deleteToken(messaging).catch(() => {});
        }
      }
    }
  } catch {
    // Continue cleaning server token and prefs even if FCM deleteToken fails
  }

  const authInfo = await getBearerIdToken();
  if (authInfo && storedToken) {
    await fetch('/api/notify/token', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authInfo.idToken}`,
      },
      body: JSON.stringify({ token: storedToken }),
    }).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  if (authInfo && authInfo.uid && authInfo.uid !== 'u_ssr') {
    await syncPushPref({
      uid: authInfo.uid,
      idToken: authInfo.idToken,
      pushEnabled: false,
      emailEnabled: opts.emailEnabled,
      reminderLocalTime: opts.reminderLocalTime,
    }).catch(() => {});
  }

  return true;
}

/**
 * On app start, if notification permission is already granted and the user has push enabled,
 * re-fetches the FCM token and re-POSTs it if rotated.
 * Never imports `firebase/messaging` when permission !== 'granted' or push is not enabled.
 */
export async function refreshPushToken(locale?: string): Promise<void> {
  if (!isPushSupported()) return;
  if (getPermission() !== 'granted') return;

  const vapidKey = getVapidKey();
  if (!vapidKey) return;

  let lastToken: string | null = null;
  try {
    lastToken = window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
  // Only refresh when the user has enabled push on this device
  if (!lastToken) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    if (!(await isSupported())) return;

    const app = getFirebaseApp();
    if (!app) return;

    const messaging = getMessaging(app);
    const freshToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });
    if (!freshToken || freshToken === lastToken) return;

    const authInfo = await getBearerIdToken();
    if (!authInfo) return;

    const res = await fetch('/api/notify/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authInfo.idToken}`,
      },
      body: JSON.stringify({
        token: freshToken,
        platform: getPushPlatform(),
        locale: locale || document.documentElement.lang || 'en',
      }),
    });
    if (res.ok) {
      window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, freshToken);
    }
  } catch {
    // Non-fatal background refresh
  }
}

export async function sendTestPush(
  locale?: string,
): Promise<{ ok: boolean; rateLimited?: boolean; error?: string }> {
  const authInfo = await getBearerIdToken();
  if (!authInfo) return { ok: false, error: 'auth_required' };

  try {
    const res = await fetch('/api/notify/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authInfo.idToken}`,
      },
      body: JSON.stringify({
        locale: locale || (typeof document !== 'undefined' ? document.documentElement.lang : 'en'),
      }),
    });
    if (res.status === 429) {
      return { ok: false, rateLimited: true, error: 'rate_limited' };
    }
    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

/** Test-only helper to reset the one-shot missing VAPID key warning flag. */
export function __resetPushWarningsForTests(): void {
  warnedMissingVapid = false;
}
