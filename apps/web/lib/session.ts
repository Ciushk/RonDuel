'use client';

export interface LocalSession {
  uid: string;
  nickname: string;
  ageConfirmed16: boolean;
  relaxedTimer: boolean;
  theme:
    | 'light'
    | 'dark'
    | 'high-contrast'
    | 'midnight-court'
    | 'clay-court'
    | 'neon-arcade';
  analyticsConsent: 'unset' | 'accepted' | 'rejected';
}

const STORAGE_KEY = 'ronduel_session_v1';

function randomUid(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `u_${hex || Math.random().toString(36).slice(2, 10)}`;
}

export function getLocalSession(): LocalSession {
  if (typeof window === 'undefined') {
    return {
      uid: 'u_ssr',
      nickname: '',
      ageConfirmed16: false,
      relaxedTimer: false,
      theme: 'light',
      analyticsConsent: 'unset',
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalSession>;
      if (parsed.uid) {
        return {
          uid: parsed.uid,
          nickname: parsed.nickname ?? '',
          ageConfirmed16: Boolean(parsed.ageConfirmed16),
          relaxedTimer: Boolean(parsed.relaxedTimer),
          theme: parsed.theme ?? 'light',
          analyticsConsent: parsed.analyticsConsent ?? 'unset',
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  const fresh: LocalSession = {
    uid: randomUid(),
    nickname: '',
    ageConfirmed16: false,
    relaxedTimer: false,
    theme: 'light',
    analyticsConsent: 'unset',
  };
  saveLocalSession(fresh);
  return fresh;
}

export function saveLocalSession(session: LocalSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearLocalSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}
