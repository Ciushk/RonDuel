'use client';

export interface LocalSession {
  uid: string;
  nickname: string;
  ageConfirmed16: boolean;
  relaxedTimer: boolean;
  theme: 'light' | 'dark' | 'high-contrast' | 'midnight-court' | 'clay-court' | 'neon-arcade';
  analyticsConsent: 'unset' | 'accepted' | 'rejected';
  email?: string;
  isAnonymous?: boolean;
  authProvider?: 'anonymous' | 'google' | 'email_link' | 'password' | 'email_password';
  createdAt?: string;
  expiresAt?: string;
  lastActiveAt?: string;
  leagueIds?: string[];
  playedDuelIds?: string[];
  lastNicknameChangeAt?: string;
}

const STORAGE_KEY = 'ronduel_session_v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
      isAnonymous: true,
      authProvider: 'anonymous',
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalSession>;
      if (parsed.uid) {
        // Cleanse corrupted mock emails from previous bug (e.g. {uid}@gmail.com)
        if (
          parsed.email &&
          parsed.uid &&
          (parsed.email.toLowerCase() === `${parsed.uid.toLowerCase()}@gmail.com` ||
            (parsed.email.toLowerCase().startsWith('u_') && parsed.email.toLowerCase().endsWith('@gmail.com')))
        ) {
          parsed.email = undefined;
          parsed.isAnonymous = true;
          parsed.authProvider = 'anonymous';
        }

        const isAnon = parsed.isAnonymous ?? !parsed.email;
        const now = Date.now();

        // 7-day TTL check for anonymous players without linked accounts
        if (isAnon && parsed.expiresAt) {
          const expiresMs = new Date(parsed.expiresAt).getTime();
          if (Number.isFinite(expiresMs) && now > expiresMs) {
            // Expired 7-day anonymous storage
            window.localStorage.removeItem(STORAGE_KEY);
            return createFreshSession();
          }
        }

        const createdAt = parsed.createdAt || new Date(now).toISOString();
        const expiresAt = isAnon
          ? (parsed.expiresAt || new Date(now + SEVEN_DAYS_MS).toISOString())
          : undefined;

        const session: LocalSession = {
          uid: parsed.uid,
          nickname: parsed.nickname ?? '',
          ageConfirmed16: Boolean(parsed.ageConfirmed16),
          relaxedTimer: Boolean(parsed.relaxedTimer),
          theme: parsed.theme ?? 'light',
          analyticsConsent: parsed.analyticsConsent ?? 'unset',
          email: parsed.email,
          isAnonymous: isAnon,
          authProvider: parsed.authProvider ?? (parsed.email ? 'google' : 'anonymous'),
          createdAt,
          expiresAt,
          lastActiveAt: new Date(now).toISOString(),
          leagueIds: Array.isArray(parsed.leagueIds) ? parsed.leagueIds : [],
          playedDuelIds: Array.isArray(parsed.playedDuelIds) ? parsed.playedDuelIds : [],
          lastNicknameChangeAt: parsed.lastNicknameChangeAt,
        };
        saveLocalSession(session);
        return session;
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return createFreshSession();
}

function createFreshSession(): LocalSession {
  const now = Date.now();
  const fresh: LocalSession = {
    uid: randomUid(),
    nickname: '',
    ageConfirmed16: false,
    relaxedTimer: false,
    theme: 'light',
    analyticsConsent: 'unset',
    isAnonymous: true,
    authProvider: 'anonymous',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SEVEN_DAYS_MS).toISOString(),
    lastActiveAt: new Date(now).toISOString(),
    leagueIds: [],
    playedDuelIds: [],
  };
  saveLocalSession(fresh);
  return fresh;
}

export function saveLocalSession(session: LocalSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('ronduel_session_updated', { detail: session }));
}

export function clearLocalSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function recordPlayedDuel(duelId: string): void {
  if (typeof window === 'undefined' || !duelId) return;
  const session = getLocalSession();
  const list = session.playedDuelIds || [];
  if (!list.includes(duelId)) {
    saveLocalSession({ ...session, playedDuelIds: [...list, duelId] });
  }
}

export function hasPlayedDuel(duelId: string): boolean {
  if (typeof window === 'undefined' || !duelId) return false;
  const session = getLocalSession();
  return Boolean(session.playedDuelIds?.includes(duelId));
}

export function recordLeagueId(leagueId: string): void {
  if (typeof window === 'undefined' || !leagueId) return;
  const session = getLocalSession();
  const list = session.leagueIds || [];
  if (!list.includes(leagueId)) {
    saveLocalSession({ ...session, leagueIds: [...list, leagueId] });
  }
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
