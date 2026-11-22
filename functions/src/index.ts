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
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

if (getApps().length === 0) {
  initializeApp();
}

import {
  approveAdminQuestion,
  createDuel,
  createLeague,
  createOrUpdateAdminQuestion,
  deleteLeague,
  deleteUserData,
  exportUserData,
  finishRound,
  generateAiQuestionDrafts,
  getAdminDashboard,
  getDuelView,
  getLeagueByCodeOrId,
  getOrCreateUser,
  getStore,
  getPlayResult,
  getRoundMeta,
  getTodayStatus,
  getUserProfile,
  joinLeague,
  leaveOrRemoveLeagueMember,
  processStripeWebhook,
  publishAdminRound,
  renameLeague,
  scheduleAdminRound,
  startDuelSide,
  startRound,
  submitAnswer,
  submitDuelAnswer,
  changeUserNickname,
  checkLeagueNameAvailable,
  checkNicknameAvailable,
  ensureUpcomingDailyRounds,
  promoteReserveRoundIfNeeded,
  unsubscribeUserEmail,
  updateNotificationPrefs,
  upgradeAccount,
} from '../../apps/web/lib/server-store.js';
import { generateLiveGeminiTemplates } from '../../apps/web/lib/ai-question-bank.js';
import { runRonBotChat } from '../../apps/web/lib/gemini-assistant.js';
import {
  adoptAuthUid,
  deleteUserFromFirestore,
  findUserByEmail,
  flushDirtyUsersToFirestore,
  getUserFromFirestore,
  purgeExpiredAnonymousUsers,
  syncUserToFirestore,
} from './firestore-users.js';

// EU data residency: all Cloud Functions run in europe-west1 (§6 & §7.2)
setGlobalOptions({ region: 'europe-west1' });

export const health = onRequest((_req, res) => {
  res.status(200).json({ ok: true, service: 'ronduel-functions', region: 'europe-west1' });
});

/**
 * Unified HTTP API handler for Firebase Hosting rewrites ("/api/**" -> api function in europe-west1).
 */
function collectRequestUids(body: Record<string, unknown>, url: URL): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value && value !== 'anon' && value !== 'u_ssr') ids.add(value);
  };
  add(body.uid);
  add(body.actorUid);
  add(body.challengerUid);
  add(body.opponentUid);
  add(body.targetUid);
  add(body.fromUid);
  add(body.toUid);
  add(url.searchParams.get('uid'));
  return [...ids];
}

export const api = onRequest({ cors: true, memory: '256MiB' }, async (req, res) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname.replace(/^\/api/, '') || '/';
    const method = req.method.toUpperCase();
    const body = (req.body ?? {}) as Record<string, unknown>;
    for (const uid of collectRequestUids(body, url)) {
      if (!getStore().users[uid]) {
        await getUserFromFirestore(uid);
      }
    }
    const originalJson = res.json.bind(res);
    let flushed = false;
    res.json = ((payload?: unknown) => {
      if (flushed) return originalJson(payload);
      flushed = true;
      return flushDirtyUsersToFirestore().then(() => originalJson(payload));
    }) as typeof res.json;

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
      const rawLeagues = url.searchParams.get('leagues');
      const clientLeagueIds = rawLeagues ? rawLeagues.split(',').filter(Boolean) : undefined;
      res.status(200).json(getTodayStatus(uid, tz, clientLeagueIds));
      return;
    }

    if (method === 'GET' && pathname === '/leagues/check-name') {
      const name = url.searchParams.get('name') ?? '';
      const excludeId = url.searchParams.get('excludeId') ?? undefined;
      res.status(200).json(checkLeagueNameAvailable(name, excludeId));
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
      const uid = String(body.uid);
      const finishRes = finishRound(uid, String(body.playId), body.clientSummary as any);
      const user = getOrCreateUser({ uid });
      await syncUserToFirestore(user);
      res.status(200).json(finishRes);
      return;
    }

    const resultMatch = pathname.match(/^\/game\/result\/([^/]+)$/);
    if (method === 'GET' && resultMatch) {
      const data = getPlayResult(decodeURIComponent(resultMatch[1]!));
      if (!data) {
        res.status(404).json({ error: 'Result not found', code: 'RESULT_NOT_FOUND' });
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
    if (leagueGetMatch) {
      const code = decodeURIComponent(leagueGetMatch[1]!);
      if (method === 'GET') {
        const uid = url.searchParams.get('uid') ?? undefined;
        const lg = getLeagueByCodeOrId(code, uid);
        if (!lg) {
          res.status(404).json({ error: 'League not found', code: 'LEAGUE_NOT_FOUND' });
          return;
        }
        res.status(200).json(lg);
        return;
      }
      if (method === 'PATCH') {
        try {
          const lg = renameLeague({
            codeOrId: code,
            actorUid: String(body.actorUid),
            name: String(body.name),
          });
          res.status(200).json({ success: true, name: lg.name });
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (method === 'DELETE') {
        try {
          const result = deleteLeague({
            codeOrId: code,
            actorUid: String(body.actorUid),
          });
          res.status(200).json(result);
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (method === 'POST') {
        try {
          const action = String(body.action);
          const targetUid = action === 'leave' ? String(body.actorUid) : String(body.targetUid);
          const result = leaveOrRemoveLeagueMember({
            codeOrId: code,
            targetUid,
            actorUid: String(body.actorUid),
          });
          res.status(200).json(result);
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
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
        res.status(404).json({ error: 'Duel not found', code: 'DUEL_NOT_FOUND' });
        return;
      }
      res.status(200).json(d);
      return;
    }

    if (method === 'GET' && pathname === '/me/profile') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      const firestoreUser = await getUserFromFirestore(uid);
      const user = getOrCreateUser({ uid });
      if (!firestoreUser) {
        await syncUserToFirestore(user);
      }
      res.status(200).json(getUserProfile(uid));
      return;
    }

    if (method === 'POST' && pathname === '/me/nickname') {
      try {
        const uid = String(body.uid ?? '');
        const nickname = String(body.nickname ?? '');
        if (!uid || !nickname) {
          res.status(400).json({ error: 'UID and nickname are required', code: 'BAD_REQUEST' });
          return;
        }
        if (body.checkOnly) {
          res.status(200).json(checkNicknameAvailable(nickname, uid));
          return;
        }
        const updated = changeUserNickname({ uid, newNickname: nickname });
        const user = getOrCreateUser({ uid });
        await syncUserToFirestore(user);
        res.status(200).json(updated);
      } catch (err: any) {
        res
          .status(400)
          .json({
            error: err?.message || 'Nickname change failed',
            code: err?.code || 'BAD_REQUEST',
          });
      }
      return;
    }

    if (method === 'POST' && pathname === '/me/adopt-auth') {
      const fromUid = String(body.fromUid ?? '');
      const toUid = String(body.toUid ?? '');
      const result = await adoptAuthUid(fromUid, toUid);
      res.status(200).json(result);
      return;
    }

    if (method === 'POST' && pathname === '/me/upgrade') {
      const oldUid = String(body.uid);
      const email = String(body.email ?? '');
      const provider = String(body.provider ?? 'password');
      if (body.targetUid) {
        const targetUid = String(body.targetUid);
        if (!getStore().users[targetUid]) await getUserFromFirestore(targetUid);
      }
      if (email) await findUserByEmail(email);
      const result = upgradeAccount({
        uid: oldUid,
        email,
        provider: provider as
          'email_link' | 'google' | 'google.com' | 'password' | 'email_password',
        nickname: body.nickname ? String(body.nickname) : undefined,
        confirmMerge:
          body.confirmMerge !== undefined
            ? Boolean(body.confirmMerge)
            : provider === 'google' || provider === 'google.com',
        targetUid: body.targetUid ? String(body.targetUid) : undefined,
      });
      if (result.uid && result.uid !== oldUid) {
        await deleteUserFromFirestore(oldUid);
        try {
          await getAuth().deleteUser(oldUid);
        } catch {
          // Local guest ids are not always Auth users.
        }
      }
      const finalUid = result.uid || oldUid;
      const targetUser = getStore().users[finalUid] ?? getOrCreateUser({ uid: finalUid });
      await syncUserToFirestore(targetUser);
      res.status(200).json(result);
      return;
    }

    if (method === 'GET' && pathname === '/me/export') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      res.status(200).json(exportUserData(uid));
      return;
    }

    if (method === 'POST' && pathname === '/me/delete') {
      const uid = String(body.uid);
      await deleteUserFromFirestore(uid);
      res.status(200).json(deleteUserData(uid));
      return;
    }

    if (method === 'POST' && pathname === '/billing/checkout') {
      const uid = String(body.uid);
      const user = getOrCreateUser({ uid });
      if (user.isAnonymous) {
        res.status(403).json({
          error: 'Please upgrade your anonymous account before purchasing RonDuel Pro.',
          code: 'FORBIDDEN',
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
      const uid = String(body.uid);
      const prefs = updateNotificationPrefs({
        uid,
        pushEnabled: Boolean(body.pushEnabled),
        emailEnabled: Boolean(body.emailEnabled),
        reminderLocalTime: String(body.reminderLocalTime ?? '18:00'),
      });
      const user = getOrCreateUser({ uid });
      await syncUserToFirestore(user);
      res.status(200).json(prefs);
      return;
    }

    if (method === 'POST' && pathname === '/admin/cleanup-expired-users') {
      const purged = await purgeExpiredAnonymousUsers();
      res.status(200).json(purged);
      return;
    }

    if (pathname === '/notify/unsubscribe') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      res.status(200).json(unsubscribeUserEmail(uid));
      return;
    }

    if (pathname === '/admin') {
      let adminIdentity: { uid: string; email?: string } | null = null;
      const authHeader = String(req.headers['authorization'] ?? '');
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        try {
          const token = authHeader.slice(7).trim();
          const decoded = await getAuth().verifyIdToken(token);
          if (decoded.admin === true) {
            adminIdentity = { uid: decoded.uid, email: decoded.email };
          }
        } catch {
          // invalid token
        }
      }
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd && req.headers['x-admin-token'] === 'local-admin') {
        adminIdentity = { uid: 'admin_ci', email: 'admin@ronduel.eu' };
      }

      if (!adminIdentity) {
        res.status(403).json({ error: 'Forbidden: admin access required', code: 'FORBIDDEN' });
        return;
      }

      if (method === 'GET') {
        res.status(200).json(getAdminDashboard());
        return;
      }
      const action = String(body.action ?? '');
      if (action === 'generate_drafts') {
        const draftParams = {
          topic: String(body.topic ?? 'Science'),
          type: (body.type as QuestionType) ?? 'mcq',
          difficulty: ((Number(body.difficulty ?? 2) as 1 | 2 | 3) || 2) as 1 | 2 | 3,
          count: Number(body.count ?? 2),
        };
        const liveTemplates = await generateLiveGeminiTemplates(draftParams);
        res.status(200).json({
          drafts: generateAiQuestionDrafts({
            ...draftParams,
            customTemplates: liveTemplates ?? undefined,
          }),
        });
        return;
      }
      if (action === 'approve_question') {
        try {
          res.status(200).json({
            question: approveAdminQuestion(
              String(body.questionId),
              adminIdentity.uid,
              adminIdentity.email,
            ),
          });
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (action === 'save_question') {
        try {
          const q = createOrUpdateAdminQuestion({
            id: body.id ? String(body.id) : undefined,
            type: body.type as QuestionType,
            difficulty: (Number(body.difficulty) || 2) as 1 | 2 | 3,
            topics: Array.isArray(body.topics) ? (body.topics as string[]) : ['general'],
            timerSec: Number(body.timerSec) || 15,
            content: body.content as any,
            extraContent: body.extraContent as any,
            answer: body.answer as any,
            reviewStatus: body.reviewStatus as any,
            actorUid: adminIdentity.uid,
            actorEmail: adminIdentity.email,
          });
          res.status(200).json({ question: q });
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (action === 'schedule_round') {
        try {
          res.status(200).json(
            scheduleAdminRound({
              date: String(body.date),
              questionIds: (body.questionIds as string[]) ?? [],
              topicOfTheDay: String(body.topicOfTheDay ?? 'Daily Duel'),
              actorUid: adminIdentity.uid,
              actorEmail: adminIdentity.email,
            }),
          );
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (action === 'publish_round') {
        try {
          res.status(200).json({
            round: publishAdminRound({
              date: String(body.date),
              explicitFallbackLocales: (body.explicitFallbackLocales as Locale[]) ?? [
                'es',
                'pt',
                'ro',
                'ro',
              ],
            }),
          });
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (action === 'rename_league') {
        try {
          const lg = renameLeague({
            codeOrId: String(body.codeOrId),
            actorUid: adminIdentity.uid,
            name: String(body.name),
            isAdmin: true,
          });
          res.status(200).json({ league: lg });
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (action === 'delete_league') {
        try {
          const r = deleteLeague({
            codeOrId: String(body.codeOrId),
            actorUid: adminIdentity.uid,
            isAdmin: true,
          });
          res.status(200).json(r);
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
        return;
      }
      if (action === 'remove_league_member') {
        try {
          const r = leaveOrRemoveLeagueMember({
            codeOrId: String(body.codeOrId),
            targetUid: String(body.targetUid),
            actorUid: adminIdentity.uid,
            isAdmin: true,
          });
          res.status(200).json(r);
        } catch (e: any) {
          res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
        }
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

    res.status(404).json({ error: `Not found: ${method} ${pathname}`, code: 'BAD_REQUEST' });
  } catch (err: any) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Bad request',
      code: err?.code || 'BAD_REQUEST',
    });
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

/**
 * Scheduled Cloud Function (Cloud Scheduler, daily 03:00 Europe/Bucharest)
 * Generates daily rounds with Gemini and maintains a 7-day buffer + reserve pool.
 */
export const dailyRoundGenerator = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Europe/Bucharest' },
  async () => {
    await ensureUpcomingDailyRounds(7);
  },
);

/**
 * Fallback promotion at 23:00 the day before if next day has no ready round.
 */
export const dailyFallbackPromoter = onSchedule(
  { schedule: '0 23 * * *', timeZone: 'Europe/Bucharest' },
  async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const dateStr = getLocalDateString(tomorrow, 'Europe/Bucharest');
    promoteReserveRoundIfNeeded(dateStr);
  },
);

/**
 * Scheduled Cloud Function (Cloud Scheduler, daily 04:00 Europe/Bucharest)
 * Automatically purges anonymous users whose 7-day retention period has passed.
 */
export const cleanupExpiredAnonymousUsers = onSchedule('every 24 hours', async () => {
  const result = await purgeExpiredAnonymousUsers();
  console.log('[Firestore] Scheduled anonymous purge', result);
});
