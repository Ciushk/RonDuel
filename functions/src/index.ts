import {
  canPublishRound,
  computeItemScore,
  getLocalDateString,
  ITEM_TIME_LIMIT_MS,
  LOCALES,
  pickWeeklyWinner,
  resolveDuelOutcome,
  shouldSendNotification,
  updateStreakWithShield,
  validateNickname,
  validateRoundSchedule,
  type Locale,
  type QuestionType,
} from '@ronduel/shared';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import {
  approveAdminQuestion,
  createDuel,
  createLeague,
  deleteUserData,
  exportUserData,
  finishRound,
  generateAiQuestionDrafts,
  getAdminDashboard,
  getDuelView,
  getLeagueByCodeOrId,
  getOrCreateUser,
  getPlayResult,
  getRoundMeta,
  getTodayStatus,
  getUserProfile,
  joinLeague,
  processStripeWebhook,
  publishAdminRound,
  scheduleAdminRound,
  startDuelSide,
  startRound,
  submitAnswer,
  submitDuelAnswer,
  unsubscribeUserEmail,
  updateNotificationPrefs,
  upgradeAccount,
} from '../../apps/web/lib/server-store.js';
import { runRonBotChat } from '../../apps/web/lib/gemini-assistant.js';

// EU data residency: all Cloud Functions run in europe-west1 (§6 & §7.2)
setGlobalOptions({ region: 'europe-west1' });

export const health = onRequest((_req, res) => {
  res.status(200).json({ ok: true, service: 'ronduel-functions', region: 'europe-west1' });
});

/**
 * Unified HTTP API handler for Firebase Hosting rewrites ("/api/**" -> api function in europe-west1).
 */
export const api = onRequest({ cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname.replace(/^\/api/, '') || '/';
    const method = req.method.toUpperCase();
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (method === 'POST' && pathname === '/chat') {
      const chatRes = await runRonBotChat({
        message: String(body.message ?? ''),
        locale: body.locale ? String(body.locale) : 'ro',
        uid: body.uid ? String(body.uid) : undefined,
        tz: body.tz ? String(body.tz) : undefined,
        nickname: body.nickname ? String(body.nickname) : undefined,
        isAdmin: Boolean(body.isAdmin),
        previousInteractionId: body.previousInteractionId
          ? String(body.previousInteractionId)
          : undefined,
      });
      res.status(200).json(chatRes);
      return;
    }

    if (method === 'GET' && pathname === '/game/status') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      const tz = url.searchParams.get('tz') ?? 'UTC';
      res.status(200).json(getTodayStatus(uid, tz));
      return;
    }

    if (method === 'POST' && pathname === '/game/start') {
      res.status(200).json(
        startRound({
          uid: String(body.uid ?? 'anon'),
          tz: String(body.tz ?? 'UTC'),
          locale: (body.locale as Locale) ?? 'en',
          nickname: body.nickname ? String(body.nickname) : undefined,
          relaxedTimer: Boolean(body.relaxedTimer),
        }),
      );
      return;
    }

    if (method === 'POST' && pathname === '/game/answer') {
      res.status(200).json(
        submitAnswer({
          uid: String(body.uid),
          playId: String(body.playId),
          index: Number(body.index),
          choice: (body.choice as number | string[] | null) ?? null,
        }),
      );
      return;
    }

    if (method === 'POST' && pathname === '/game/finish') {
      res.status(200).json(finishRound(String(body.uid), String(body.playId)));
      return;
    }

    const resultMatch = pathname.match(/^\/game\/result\/([^/]+)$/);
    if (method === 'GET' && resultMatch) {
      const data = getPlayResult(decodeURIComponent(resultMatch[1]!));
      if (!data) {
        res.status(404).json({ error: 'Result not found' });
        return;
      }
      res.status(200).json(data);
      return;
    }

    if (method === 'POST' && pathname === '/leagues') {
      const lg = createLeague({
        uid: String(body.uid),
        name: body.name ? String(body.name) : undefined,
        tz: String(body.tz ?? 'UTC'),
        locale: (body.locale as Locale) ?? 'en',
      });
      res.status(200).json({ leagueId: lg.id, name: lg.name, inviteCode: lg.inviteCode });
      return;
    }

    const leagueJoinMatch = pathname.match(/^\/leagues\/([^/]+)\/join$/);
    if (method === 'POST' && leagueJoinMatch) {
      const lg = joinLeague({
        inviteCode: decodeURIComponent(leagueJoinMatch[1]!),
        uid: String(body.uid),
        nickname: String(body.nickname),
        tz: String(body.tz ?? 'UTC'),
      });
      res.status(200).json({ leagueId: lg.id, name: lg.name, inviteCode: lg.inviteCode });
      return;
    }

    const leagueGetMatch = pathname.match(/^\/leagues\/([^/]+)$/);
    if (method === 'GET' && leagueGetMatch) {
      const uid = url.searchParams.get('uid') ?? undefined;
      const lg = getLeagueByCodeOrId(decodeURIComponent(leagueGetMatch[1]!), uid);
      if (!lg) {
        res.status(404).json({ error: 'League not found' });
        return;
      }
      res.status(200).json(lg);
      return;
    }

    if (method === 'POST' && pathname === '/duels') {
      const d = createDuel({
        challengerUid: String(body.challengerUid),
        opponentUid: body.opponentUid ? String(body.opponentUid) : null,
        leagueId: body.leagueId ? String(body.leagueId) : undefined,
        tz: String(body.tz ?? 'UTC'),
        nickname: body.nickname ? String(body.nickname) : undefined,
      });
      res.status(200).json({ duelId: d.id, status: d.status });
      return;
    }

    const duelStartMatch = pathname.match(/^\/duels\/([^/]+)\/start$/);
    if (method === 'POST' && duelStartMatch) {
      res.status(200).json(
        startDuelSide({
          duelId: decodeURIComponent(duelStartMatch[1]!),
          uid: String(body.uid),
          nickname: body.nickname ? String(body.nickname) : undefined,
          locale: (body.locale as Locale) ?? 'en',
        }),
      );
      return;
    }

    const duelAnswerMatch = pathname.match(/^\/duels\/([^/]+)\/answer$/);
    if (method === 'POST' && duelAnswerMatch) {
      res.status(200).json(
        submitDuelAnswer({
          duelId: decodeURIComponent(duelAnswerMatch[1]!),
          uid: String(body.uid),
          index: Number(body.index),
          choice: (body.choice as number | string[] | null) ?? null,
          locale: (body.locale as Locale) ?? 'en',
        }),
      );
      return;
    }

    const duelGetMatch = pathname.match(/^\/duels\/([^/]+)$/);
    if (method === 'GET' && duelGetMatch) {
      const rawLoc = url.searchParams.get('locale') ?? 'en';
      const locale: Locale = LOCALES.includes(rawLoc as Locale) ? (rawLoc as Locale) : 'en';
      const d = getDuelView(decodeURIComponent(duelGetMatch[1]!), locale);
      if (!d) {
        res.status(404).json({ error: 'Duel not found' });
        return;
      }
      res.status(200).json(d);
      return;
    }

    if (method === 'GET' && pathname === '/me/profile') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      res.status(200).json(getUserProfile(uid));
      return;
    }

    if (method === 'POST' && pathname === '/me/upgrade') {
      res.status(200).json(
        upgradeAccount({
          uid: String(body.uid),
          email: String(body.email),
          provider: (body.provider as 'email_link' | 'google') ?? 'email_link',
        }),
      );
      return;
    }

    if (method === 'GET' && pathname === '/me/export') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      res.status(200).json(exportUserData(uid));
      return;
    }

    if (method === 'POST' && pathname === '/me/delete') {
      res.status(200).json(deleteUserData(String(body.uid)));
      return;
    }

    if (method === 'POST' && pathname === '/billing/checkout') {
      const uid = String(body.uid);
      const user = getOrCreateUser({ uid });
      if (user.isAnonymous) {
        res.status(403).json({
          error: 'Please upgrade your anonymous account before purchasing RonDuel Pro.',
        });
        return;
      }
      const plan = (body.plan as 'monthly' | 'yearly') ?? 'yearly';
      const eventId = `evt_cf_${Date.now()}_${uid}`;
      const wh = processStripeWebhook({
        eventId,
        type: 'checkout.session.completed',
        uid,
        plan,
      });
      res.status(200).json({ mode: 'local_test_webhook', eventId, pro: wh.pro });
      return;
    }

    if (method === 'POST' && pathname === '/billing/webhook') {
      res.status(200).json(
        processStripeWebhook({
          eventId: String(body.id),
          type: body.type as
            | 'checkout.session.completed'
            | 'customer.subscription.updated'
            | 'customer.subscription.deleted',
          uid: String(body.uid),
          plan: body.plan as 'monthly' | 'yearly' | undefined,
        }),
      );
      return;
    }

    if (method === 'POST' && pathname === '/notify/prefs') {
      res.status(200).json(
        updateNotificationPrefs({
          uid: String(body.uid),
          pushEnabled: Boolean(body.pushEnabled),
          emailEnabled: Boolean(body.emailEnabled),
          reminderLocalTime: String(body.reminderLocalTime ?? '18:00'),
        }),
      );
      return;
    }

    if (pathname === '/notify/unsubscribe') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      res.status(200).json(unsubscribeUserEmail(uid));
      return;
    }

    if (pathname === '/admin') {
      const isAdmin = req.headers['x-admin-token'] === 'local-admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Forbidden: admin access required' });
        return;
      }
      if (method === 'GET') {
        res.status(200).json(getAdminDashboard());
        return;
      }
      const action = String(body.action ?? '');
      if (action === 'generate_drafts') {
        res.status(200).json({
          drafts: generateAiQuestionDrafts({
            topic: String(body.topic ?? 'Science'),
            type: (body.type as QuestionType) ?? 'mcq',
            difficulty: (Number(body.difficulty ?? 2) as 1 | 2 | 3) || 2,
            count: Number(body.count ?? 2),
          }),
        });
        return;
      }
      if (action === 'approve_question') {
        res.status(200).json({ question: approveAdminQuestion(String(body.questionId)) });
        return;
      }
      if (action === 'schedule_round') {
        res.status(200).json(
          scheduleAdminRound({
            date: String(body.date),
            questionIds: (body.questionIds as string[]) ?? [],
            topicOfTheDay: String(body.topicOfTheDay ?? 'Daily Duel'),
          }),
        );
        return;
      }
      if (action === 'publish_round') {
        res.status(200).json({
          round: publishAdminRound({
            date: String(body.date),
            explicitFallbackLocales: (body.explicitFallbackLocales as Locale[]) ?? [
              'es',
              'pt',
              'ro',
            ],
          }),
        });
        return;
      }
    }

    const ogLeagueMatch = pathname.match(/^\/og\/league\/([^/]+)$/);
    if (method === 'GET' && ogLeagueMatch) {
      const code = decodeURIComponent(ogLeagueMatch[1]!);
      const lg = getLeagueByCodeOrId(code);
      const meta = getRoundMeta(getLocalDateString(new Date(), lg?.tz ?? 'UTC'));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#FFF7EC"/><text x="56" y="110" font-family="sans-serif" font-size="52" font-weight="800" fill="#D7261E">RonDuel #${meta.roundNumber}</text><text x="56" y="310" font-family="sans-serif" font-size="64" font-weight="800" fill="#16131F">${lg?.name ?? `League ${code}`}</text><text x="56" y="380" font-family="sans-serif" font-size="32" fill="#5B5668">Can you beat them?</text><rect x="56" y="550" width="544" height="16" fill="#FF5A4E"/><rect x="600" y="550" width="544" height="16" fill="#3D7BFF"/></svg>`;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.status(200).send(svg);
      return;
    }

    res.status(404).json({ error: `Not found: ${method} ${pathname}` });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
  }
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

export const hourlyLeagueRollover = onSchedule('0 * * * *', async () => {
  void pickWeeklyWinner;
  void updateStreakWithShield;
});

export const hourlyReminders = onSchedule('15 * * * *', async () => {
  void shouldSendNotification;
});

export const dailyDuelExpiry = onSchedule('30 0 * * *', async () => {
  void resolveDuelOutcome;
});

export const dailyContentGuard = onSchedule('0 12 * * *', async () => {
  void validateRoundSchedule;
  void canPublishRound;
});
