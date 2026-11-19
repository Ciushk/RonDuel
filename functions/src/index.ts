import {
  canPublishRound,
  computeItemScore,
  ITEM_TIME_LIMIT_MS,
  pickWeeklyWinner,
  resolveDuelOutcome,
  shouldSendNotification,
  updateStreakWithShield,
  validateNickname,
  validateRoundSchedule,
} from '@ronduel/shared';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// EU data residency: all Cloud Functions run in europe-west1 (§6 & §7.2)
setGlobalOptions({ region: 'europe-west1' });

export const health = onRequest((_req, res) => {
  res.status(200).json({ ok: true, service: 'ronduel-functions', region: 'europe-west1' });
});

export const setNickname = onCall({ enforceAppCheck: true }, (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const raw = String(request.data?.nickname ?? '');
  const check = validateNickname(raw);
  if (!check.ok) {
    throw new HttpsError('invalid-argument', `Invalid nickname: ${check.reason}`);
  }
  return { uid: request.auth.uid, nickname: check.value };
});

export const scoreItemServer = onCall({ enforceAppCheck: true }, (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const type = (request.data?.type ?? 'mcq') as keyof typeof ITEM_TIME_LIMIT_MS;
  const elapsedMs = Number(request.data?.elapsedMs ?? 0);
  const correct = Boolean(request.data?.correct);
  return computeItemScore({
    correct,
    elapsedMs,
    limitMs: ITEM_TIME_LIMIT_MS[type] ?? 10_000,
  });
});

// Scheduled functions (§7.2)
export const hourlyLeagueRollover = onSchedule('0 * * * *', async () => {
  // Evaluates weekly standings and picks winner via pickWeeklyWinner (tie-broken by lower totalMs)
  void pickWeeklyWinner;
  void updateStreakWithShield;
});

export const hourlyReminders = onSchedule('15 * * * *', async () => {
  // Dispatches max 2 notifications/day to opted-in users who haven't played today
  void shouldSendNotification;
});

export const dailyDuelExpiry = onSchedule('30 0 * * *', async () => {
  // Resolves 24h expired duels and walkover wins
  void resolveDuelOutcome;
});

export const dailyContentGuard = onSchedule('0 12 * * *', async () => {
  // Checks tomorrow's round schedule & locale coverage at 12:00 UTC
  void validateRoundSchedule;
  void canPublishRound;
});
