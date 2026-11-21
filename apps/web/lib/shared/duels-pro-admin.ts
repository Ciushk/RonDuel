import { diffCalendarDays, deterministicShuffle, type Question } from './schemas';
import { type Locale } from './scoring';

export const DUEL_ITEM_COUNT = 5;
export const DUEL_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const ANTI_REPETITION_DAYS = 180;
export const MAX_NOTIFICATIONS_PER_DAY = 2;

export const PRO_THEMES = ['midnight-court', 'clay-court', 'neon-arcade'] as const;
export type ProTheme = (typeof PRO_THEMES)[number];
export type AppTheme = 'light' | 'dark' | 'high-contrast' | ProTheme;

/**
 * Selects 5 questions for a 1v1 duel, strictly excluding any question scheduled
 * in today's daily round or the next 7 days' daily rounds (§3 & Phase 2 acceptance).
 */
export function selectDuelQuestions(params: {
  allQuestions: readonly Question[];
  forbiddenQuestionIds: ReadonlySet<string>;
  seed: string;
}): Question[] {
  const eligible = params.allQuestions.filter(
    (q) => q.reviewStatus === 'approved' && !params.forbiddenQuestionIds.has(q.id),
  );
  const shuffled = deterministicShuffle(eligible, params.seed);
  return shuffled.slice(0, DUEL_ITEM_COUNT);
}

export interface DuelSideResult {
  uid: string;
  nickname: string;
  score: number;
  totalMs: number;
  finishedAt?: string;
}

export interface DuelOutcome {
  status: 'pending' | 'active' | 'complete' | 'expired';
  winnerUid: string | null;
  walkover: boolean;
}

/**
 * Computes duel outcome including ties (lower totalMs wins) and 24h expiry / walkover (§3).
 */
export function resolveDuelOutcome(params: {
  challengerUid: string;
  opponentUid?: string | null;
  createdAtMs: number;
  nowMs: number;
  challengerSide?: DuelSideResult;
  opponentSide?: DuelSideResult;
}): DuelOutcome {
  const { challengerUid, opponentUid, createdAtMs, nowMs, challengerSide, opponentSide } = params;

  const challengerDone = Boolean(challengerSide?.finishedAt);
  const opponentDone = Boolean(opponentSide?.finishedAt);

  if (challengerDone && opponentDone && challengerSide && opponentSide) {
    if (challengerSide.score > opponentSide.score) {
      return { status: 'complete', winnerUid: challengerUid, walkover: false };
    }
    if (opponentSide.score > challengerSide.score) {
      return { status: 'complete', winnerUid: opponentUid ?? opponentSide.uid, walkover: false };
    }
    // Tie-breaker: lower total server-measured time
    const winnerUid =
      challengerSide.totalMs <= opponentSide.totalMs
        ? challengerUid
        : (opponentUid ?? opponentSide.uid);
    return { status: 'complete', winnerUid, walkover: false };
  }

  // Expiry check: 24h after challenger finishes if opponent never plays => walkover win
  if (challengerDone && !opponentDone && challengerSide?.finishedAt) {
    const finishedMs = Date.parse(challengerSide.finishedAt);
    if (nowMs - finishedMs >= DUEL_EXPIRY_MS) {
      return { status: 'complete', winnerUid: challengerUid, walkover: true };
    }
    return { status: 'active', winnerUid: null, walkover: false };
  }

  // Expiry check: 24h after creation if nobody completed
  if (nowMs - createdAtMs >= DUEL_EXPIRY_MS) {
    return { status: 'expired', winnerUid: null, walkover: false };
  }

  return {
    status: challengerDone || opponentDone ? 'active' : 'pending',
    winnerUid: null,
    walkover: false,
  };
}

/** Computes ISO week string (e.g. "2026-W49") for a YYYY-MM-DD date. */
export function getIsoWeekString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Streak update with Pro weekly automatic streak shield (§2.4 & §5):
 * Pro users get 1 automatic shield per ISO week covering a single missed day (diff === 2).
 */
export function updateStreakWithShield(params: {
  lastPlayedDate?: string;
  currentDate: string;
  streakCurrent: number;
  streakBest: number;
  isPro: boolean;
  streakShieldUsedWeek?: string;
}): {
  streakCurrent: number;
  streakBest: number;
  streakShieldUsedWeek?: string;
  shieldTriggered: boolean;
} {
  const { lastPlayedDate, currentDate, streakCurrent, streakBest, isPro, streakShieldUsedWeek } =
    params;

  if (!lastPlayedDate) {
    return {
      streakCurrent: 1,
      streakBest: Math.max(streakBest, 1),
      streakShieldUsedWeek,
      shieldTriggered: false,
    };
  }

  const diff = diffCalendarDays(lastPlayedDate, currentDate);
  if (diff === 0) {
    return { streakCurrent, streakBest, streakShieldUsedWeek, shieldTriggered: false };
  }
  if (diff === 1) {
    const next = streakCurrent + 1;
    return {
      streakCurrent: next,
      streakBest: Math.max(streakBest, next),
      streakShieldUsedWeek,
      shieldTriggered: false,
    };
  }

  const currentIsoWeek = getIsoWeekString(currentDate);
  if (diff === 2 && isPro && streakShieldUsedWeek !== currentIsoWeek) {
    const next = streakCurrent + 1;
    return {
      streakCurrent: next,
      streakBest: Math.max(streakBest, next),
      streakShieldUsedWeek: currentIsoWeek,
      shieldTriggered: true,
    };
  }

  return {
    streakCurrent: 1,
    streakBest: Math.max(streakBest, 1),
    streakShieldUsedWeek,
    shieldTriggered: false,
  };
}

/**
 * Phase 4 notification eligibility & platform detection (§6.1 & Phase 4 acceptance):
 * - On iOS Safari tab (isIos && !isStandalone), Web Push is hidden and email is offered.
 * - Max 2 notifications per user per day.
 * - Daily reminders are skipped if the user has already played today.
 */
export function getNotificationChannelCapability(params: {
  isIos: boolean;
  isStandalone: boolean;
  pushSupported: boolean;
}): { canUseWebPush: boolean; offerEmailFallback: boolean } {
  if (params.isIos && !params.isStandalone) {
    return { canUseWebPush: false, offerEmailFallback: true };
  }
  return {
    canUseWebPush: params.pushSupported,
    offerEmailFallback: !params.pushSupported,
  };
}

export function shouldSendNotification(params: {
  type: 'daily_reminder' | 'duel_challenge' | 'weekly_winner';
  playedToday: boolean;
  sentTodayCount: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
}): { send: boolean; channel: 'push' | 'email' | null; reason?: string } {
  if (params.sentTodayCount >= MAX_NOTIFICATIONS_PER_DAY) {
    return { send: false, channel: null, reason: 'daily_cap_reached' };
  }
  if (params.type === 'daily_reminder' && params.playedToday) {
    return { send: false, channel: null, reason: 'already_played_today' };
  }
  if (params.pushEnabled) {
    return { send: true, channel: 'push' };
  }
  if (params.emailEnabled) {
    return { send: true, channel: 'email' };
  }
  return { send: false, channel: null, reason: 'no_channel_opted_in' };
}

/**
 * Phase 5 Admin validations (§4.3 & §4.4):
 * 1. AI drafts cannot be scheduled until approved (`reviewStatus === 'approved'`).
 * 2. 180-day anti-repetition rule blocks scheduling a question used within 180 days.
 * 3. Consecutive-day same-topic warning.
 * 4. Publish guard: every launch locale must be 'reviewed' or explicitly marked 'fallbackAllowed'.
 */
export function validateRoundSchedule(params: {
  date: string;
  questions: readonly Question[];
  previousDayTopics?: readonly string[];
}): {
  ok: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (params.questions.length !== 6) {
    errors.push(`Round must have 6 questions (got ${params.questions.length}).`);
  }

  for (const q of params.questions) {
    if (q.reviewStatus !== 'approved') {
      errors.push(
        `Question ${q.id} (source: ${q.source}) has reviewStatus '${q.reviewStatus}' and cannot be scheduled until approved.`,
      );
    }
    const lastUsedOn = (q as Question & { lastUsedOn?: string }).lastUsedOn;
    if (lastUsedOn) {
      const daysSince = Math.abs(diffCalendarDays(lastUsedOn, params.date));
      if (daysSince > 0 && daysSince < ANTI_REPETITION_DAYS) {
        errors.push(
          `Question ${q.id} was used on ${lastUsedOn} (${daysSince} days ago, minimum is ${ANTI_REPETITION_DAYS} days).`,
        );
      }
    }
  }

  if (params.previousDayTopics && params.previousDayTopics.length > 0) {
    const prevSet = new Set(params.previousDayTopics);
    const todayTopics = new Set(params.questions.flatMap((q) => q.topics));
    for (const topic of todayTopics) {
      if (prevSet.has(topic)) {
        warnings.push(`Topic '${topic}' also appeared on the previous day.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function canPublishRound(params: {
  questions: readonly Question[];
  explicitFallbackLocales: ReadonlySet<Locale>;
}): { ok: boolean; missingLocales: Locale[] } {
  const requiredLocales: Locale[] = ['en', 'es', 'pt', 'ro'];
  const missingLocales: Locale[] = [];

  for (const loc of requiredLocales) {
    const allReviewed = params.questions.every((q) => q.translationStatus[loc] === 'reviewed');
    if (!allReviewed && !params.explicitFallbackLocales.has(loc)) {
      missingLocales.push(loc);
    }
  }

  return { ok: missingLocales.length === 0, missingLocales };
}

/** Normalized-text token Jaccard similarity for duplicate detection in Admin (§4.4). */
export function computePromptSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
