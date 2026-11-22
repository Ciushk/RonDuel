import { computeAnonExpiry, type ExpiryUser } from './anon-retention';

export interface UserDocInput extends ExpiryUser {
  uid: string;
  nickname?: string;
  locale?: string;
  tz?: string;
  authProvider?: string;
  isAdmin?: boolean;
  pro?: unknown;
  notif?: unknown;
  streakCurrent?: number;
  streakBest?: number;
  lastPlayedDate?: string | null;
  leagueIds?: string[];
  freezes?: number;
  duelStats?: unknown;
  createdAt?: string | null;
  upgradedAt?: string | null;
  country?: string | null;
  relaxedTimer?: boolean;
  ageConfirmed16?: boolean;
  lastNicknameChangeAt?: string | null;
  streakShieldUsedWeek?: string | null;
  rivals?: unknown;
  freezeLedger?: unknown;
}

/**
 * Plain user document. `expiresAt` is a Date for anonymous users and null once
 * the account is saved. Callers persist Date values as Firestore Timestamps.
 */
export function formatUserDoc(user: UserDocInput, now = Date.now()) {
  const anonymous = user.isAnonymous !== false && !user.email;
  return {
    uid: user.uid,
    nickname: user.nickname ?? '',
    locale: user.locale || 'en',
    tz: user.tz || 'UTC',
    isAnonymous: anonymous,
    email: user.email || null,
    authProvider: user.authProvider || (anonymous ? 'anonymous' : 'password'),
    isAdmin: Boolean(user.isAdmin),
    pro: user.pro || { active: false },
    notif: user.notif || {
      pushEnabled: false,
      emailEnabled: false,
      reminderLocalTime: '18:00',
      sentTodayCount: 0,
    },
    streakCurrent: user.streakCurrent ?? 0,
    streakBest: user.streakBest ?? 0,
    lastPlayedDate: user.lastPlayedDate || null,
    leagueIds: user.leagueIds || ['lg_world'],
    freezes: user.freezes ?? 0,
    duelStats: user.duelStats || null,
    createdAt: user.createdAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    upgradedAt: user.upgradedAt ?? null,
    country: user.country ?? null,
    relaxedTimer: Boolean(user.relaxedTimer),
    ageConfirmed16: user.ageConfirmed16 ?? true,
    lastNicknameChangeAt: user.lastNicknameChangeAt ?? null,
    streakShieldUsedWeek: user.streakShieldUsedWeek ?? null,
    rivals: user.rivals ?? {},
    freezeLedger: user.freezeLedger ?? [],
    expiresAt: computeAnonExpiry(user, now),
  };
}
