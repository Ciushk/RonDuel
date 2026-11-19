import { describe, expect, it } from 'vitest';

import {
  canPublishRound,
  computePromptSimilarity,
  DUEL_EXPIRY_MS,
  getNotificationChannelCapability,
  resolveDuelOutcome,
  selectDuelQuestions,
  shouldSendNotification,
  updateStreakWithShield,
  validateRoundSchedule,
} from './duels-pro-admin.js';
import type { Question } from './schemas.js';

function makeQuestion(
  id: string,
  overrides: Partial<Question & { lastUsedOn?: string }> = {},
): Question & { lastUsedOn?: string } {
  return {
    id,
    type: 'mcq',
    difficulty: 1,
    topics: ['science'],
    content: {
      en: {
        prompt: `Question prompt for ${id}`,
        options: ['A', 'B', 'C', 'D'],
      },
    },
    answer: { correctIndex: 0 },
    translationStatus: { en: 'reviewed', es: 'missing', pt: 'missing', ro: 'missing' },
    source: 'human',
    reviewStatus: 'approved',
    usageCount: 0,
    ...overrides,
  };
}

describe('Phase 2: Duels logic', () => {
  it('never selects duel questions from today or next 7 days daily rounds', () => {
    const pool = Array.from({ length: 12 }, (_, i) => makeQuestion(`q-${i + 1}`));
    const forbidden = new Set(['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6']);
    const picked = selectDuelQuestions({
      allQuestions: pool,
      forbiddenQuestionIds: forbidden,
      seed: 'duel-123',
    });
    expect(picked).toHaveLength(5);
    for (const q of picked) {
      expect(forbidden.has(q.id)).toBe(false);
    }
  });

  it('resolves duel winner by score and breaks ties by lower totalMs', () => {
    const tie = resolveDuelOutcome({
      challengerUid: 'u1',
      opponentUid: 'u2',
      createdAtMs: 1000,
      nowMs: 5000,
      challengerSide: {
        uid: 'u1',
        nickname: 'Ana',
        score: 800,
        totalMs: 25_000,
        finishedAt: '2026-12-01T10:00:00Z',
      },
      opponentSide: {
        uid: 'u2',
        nickname: 'Mihai',
        score: 800,
        totalMs: 21_000,
        finishedAt: '2026-12-01T10:05:00Z',
      },
    });
    expect(tie).toEqual({ status: 'complete', winnerUid: 'u2', walkover: false });
  });

  it('awards walkover win 24h after challenger finishes if opponent never plays', () => {
    const finishedAt = '2026-12-01T10:00:00Z';
    const outcome = resolveDuelOutcome({
      challengerUid: 'u1',
      opponentUid: 'u2',
      createdAtMs: Date.parse(finishedAt) - 10_000,
      nowMs: Date.parse(finishedAt) + DUEL_EXPIRY_MS + 1,
      challengerSide: { uid: 'u1', nickname: 'Ana', score: 750, totalMs: 22_000, finishedAt },
    });
    expect(outcome).toEqual({ status: 'complete', winnerUid: 'u1', walkover: true });
  });
});

describe('Phase 3: Pro streak shield', () => {
  it('protects a 1-day gap for Pro users once per ISO week', () => {
    const first = updateStreakWithShield({
      lastPlayedDate: '2026-12-01',
      currentDate: '2026-12-03', // missed Dec 2
      streakCurrent: 5,
      streakBest: 5,
      isPro: true,
    });
    expect(first.streakCurrent).toBe(6);
    expect(first.shieldTriggered).toBe(true);
    expect(first.streakShieldUsedWeek).toBe('2026-W49');

    // Second miss in the same ISO week resets streak
    const second = updateStreakWithShield({
      lastPlayedDate: '2026-12-03',
      currentDate: '2026-12-05',
      streakCurrent: first.streakCurrent,
      streakBest: first.streakBest,
      isPro: true,
      streakShieldUsedWeek: first.streakShieldUsedWeek,
    });
    expect(second.streakCurrent).toBe(1);
    expect(second.shieldTriggered).toBe(false);
  });
});

describe('Phase 4: Notifications rules', () => {
  it('hides Web Push on iOS Safari tab and enables it in standalone mode', () => {
    expect(
      getNotificationChannelCapability({ isIos: true, isStandalone: false, pushSupported: true }),
    ).toEqual({ canUseWebPush: false, offerEmailFallback: true });

    expect(
      getNotificationChannelCapability({ isIos: true, isStandalone: true, pushSupported: true }),
    ).toEqual({ canUseWebPush: true, offerEmailFallback: false });
  });

  it('enforces max 2 notifications per day and skips reminder if already played', () => {
    expect(
      shouldSendNotification({
        type: 'daily_reminder',
        playedToday: true,
        sentTodayCount: 0,
        pushEnabled: true,
        emailEnabled: false,
      }),
    ).toEqual({ send: false, channel: null, reason: 'already_played_today' });

    expect(
      shouldSendNotification({
        type: 'duel_challenge',
        playedToday: true,
        sentTodayCount: 2,
        pushEnabled: true,
        emailEnabled: false,
      }),
    ).toEqual({ send: false, channel: null, reason: 'daily_cap_reached' });
  });
});

describe('Phase 5: Admin scheduling, AI draft gate, 180-day anti-repetition, and locale coverage', () => {
  it('blocks scheduling unapproved AI drafts and questions reused within 180 days', () => {
    const qs = [
      makeQuestion('q-1', { source: 'ai_draft', reviewStatus: 'draft' }),
      makeQuestion('q-2', { lastUsedOn: '2026-10-15' }),
      makeQuestion('q-3'),
      makeQuestion('q-4'),
      makeQuestion('q-5'),
      makeQuestion('q-6'),
    ];
    const res = validateRoundSchedule({
      date: '2026-12-01',
      questions: qs,
      previousDayTopics: ['science'],
    });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('q-1'))).toBe(true);
    expect(res.errors.some((e) => e.includes('q-2') && e.includes('180 days'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('science'))).toBe(true);
  });

  it('blocks publishing a round unless all launch locales are reviewed or explicitly marked fallback', () => {
    const qs = Array.from({ length: 6 }, (_, i) => makeQuestion(`q-${i + 1}`));
    expect(canPublishRound({ questions: qs, explicitFallbackLocales: new Set() })).toEqual({
      ok: false,
      missingLocales: ['es', 'pt', 'ro'],
    });

    expect(
      canPublishRound({
        questions: qs,
        explicitFallbackLocales: new Set(['es', 'pt', 'ro']),
      }),
    ).toEqual({ ok: true, missingLocales: [] });
  });

  it('detects duplicate question prompts by similarity', () => {
    const sim = computePromptSimilarity(
      'What is the capital of Australia?',
      'What is the capital city of Australia?',
    );
    expect(sim).toBeGreaterThan(0.6);
  });
});
