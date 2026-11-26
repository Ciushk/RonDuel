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
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';

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
  getUserDuels,
  getUserProfile,
  joinLeague,
  leaveOrRemoveLeagueMember,
  markUserDirty,
  processStripeWebhook,
  publishAdminRound,
  regenerateLeagueInviteCode,
  renameLeague,
  scheduleAdminRound,
  setLeaguePrivateApproval,
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
import { authorizeRonBotChat } from '../../apps/web/lib/ronbot-auth.js';
import {
  adoptAuthUid,
  deleteUserFromFirestore,
  findUserByEmail,
  flushDirtyUsersToFirestore,
  getDb,
  getUserFromFirestore,
  purgeExpiredAnonymousUsers,
  syncUserToFirestore,
} from './firestore-users.js';
import { createStorePersistence, type FirestoreLike } from './store-persistence.js';
import { createProCheckout, handleStripeWebhook } from './billing.js';
import { getStripe, verifyStripeEvent } from './stripe-client.js';
import { processAwardTriviaCoins } from './town-award.js';
import { initPlayerTown } from './town-init.js';
import { rotateTownElement } from './town-rotate.js';
import { speedupCrop } from './town-speedup.js';
import { completeFamilyEvent } from './town-family.js';
import { setTutorialStep } from './town-tutorial.js';
import {
  buildItem,
  buyFarmPlot,
  buyLandTile,
  getTownCatalog,
  moveTile,
  removeTile,
} from './town-actions.js';
import { deliverOrder, getOrCreateDailyOrders, harvestCrop, plantCrop } from './town-farming.js';
import { getTownVisit, likeTown } from './town-snapshots.js';
import { createCoinCheckoutSession, handleTownStripeWebhook } from './town-purchase.js';
import { getTransferStatus, transferCoins } from './town-transfer.js';
import { getFriendWaterStatus, waterFriendCrop } from './town-help.js';
import { batchReconcileLedgers } from './town-wallet.js';
import { notifyCropsReady } from './town-notifications.js';
import {
  handleNotifyTestRequest,
  handleNotifyTokenRequest,
  runHourlyReminders,
  sendPushToUser,
} from './push.js';

export { notifyCropsReady, sendPushToUser };

// EU data residency: all Cloud Functions run in europe-west1 (§6 & §7.2)
setGlobalOptions({ region: 'europe-west1' });

/**
 * The game store lives in memory and is mirrored to Firestore (see store-persistence.ts):
 * saved data is loaded before the first request and changes are saved before each response.
 */
const storePersistence = createStorePersistence({
  getDb: () => getDb() as unknown as FirestoreLike,
  getStore: () => getStore() as unknown as Record<string, unknown>,
});

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_PRICE_PRO_MONTHLY = defineString('STRIPE_PRICE_PRO_MONTHLY', { default: '' });
const STRIPE_PRICE_PRO_YEARLY = defineString('STRIPE_PRICE_PRO_YEARLY', { default: '' });
const PUBLIC_BASE_URL = defineString('PUBLIC_BASE_URL', { default: 'https://ronduel.web.app' });

// One instance on purpose: each instance trusts its own memory for reads, so two instances would
// show different leaderboards. cpu 1 and concurrency 40 let that single instance serve many players.
const apiOptions = {
  cors: true,
  memory: '512MiB' as const,
  cpu: 1,
  concurrency: 40,
  minInstances: 1,
  maxInstances: 1,
  secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
};

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

function readStripeSignatureHeader(header: string | string[] | undefined): string | undefined {
  if (typeof header === 'string') return header;
  if (Array.isArray(header)) return header[0];
  return undefined;
}

export const api = onRequest(apiOptions, async (req, res) => {
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
    const isStripeWebhookRoute =
      method === 'POST' && (pathname === '/billing/webhook' || pathname === '/town/stripe-webhook');
    const body = isStripeWebhookRoute ? {} : ((req.body ?? {}) as Record<string, unknown>);
    await storePersistence.ensureHydrated();
    if (!isStripeWebhookRoute && pathname !== '/billing/checkout') {
      for (const uid of collectRequestUids(body, url)) {
        if (!getStore().users[uid]) {
          await getUserFromFirestore(uid);
        }
      }
    }
    const originalJson = res.json.bind(res);
    let flushed = false;
    res.json = ((payload?: unknown) => {
      if (flushed) return originalJson(payload);
      flushed = true;
      return flushDirtyUsersToFirestore()
        .then(() => storePersistence.flushNow())
        .then(() => originalJson(payload));
    }) as typeof res.json;

    if (method === 'POST' && pathname === '/chat') {
      const auth = await authorizeRonBotChat({
        authHeader:
          typeof req.headers['authorization'] === 'string' ? req.headers['authorization'] : null,
        testUidHeader:
          typeof req.headers['x-test-uid'] === 'string' ? req.headers['x-test-uid'] : null,
        verifyIdToken: async (token) => {
          const decoded = await getAuth().verifyIdToken(token);
          return { uid: decoded.uid };
        },
        loadUser: async (uid) => {
          if (!getStore().users[uid]) {
            await getUserFromFirestore(uid);
          }
          return getStore().users[uid];
        },
      });
      if (!auth.ok) {
        res.status(auth.status).json({ error: auth.error });
        return;
      }

      const chatRes = await runRonBotChat({
        message: String(body.message ?? ''),
        locale: body.locale ? String(body.locale) : 'ro',
        uid: auth.uid,
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

    if ((method === 'POST' || method === 'GET') && pathname === '/town/init') {
      const uid = String(body.uid ?? url.searchParams.get('uid') ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing or invalid uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await initPlayerTown(db, uid);
        const [tilesSnap, walletSnap] = await Promise.all([
          db.collection('users').doc(uid).collection('townTiles').get(),
          db.collection('users').doc(uid).collection('wallet').doc('main').get(),
        ]);
        const tiles: Record<string, unknown> = {};
        for (const doc of tilesSnap.docs) {
          const data = doc.data();
          const serializeTs = (val: unknown) => {
            if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
              return new Date((val as { toMillis: () => number }).toMillis()).toISOString();
            }
            return val;
          };
          tiles[doc.id] = {
            ...data,
            ...(data.plantedAt ? { plantedAt: serializeTs(data.plantedAt) } : {}),
            ...(data.readyAt ? { readyAt: serializeTs(data.readyAt) } : {}),
          };
        }
        const toEpochMs = (val: unknown): number | undefined => {
          if (typeof val === 'number' && Number.isFinite(val)) return val;
          if (val instanceof Date) return val.getTime();
          if (typeof val === 'string') {
            const ms = Date.parse(val);
            return Number.isNaN(ms) ? undefined : ms;
          }
          if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
            return (val as { toMillis: () => number }).toMillis();
          }
          return undefined;
        };
        const createdAtMs = toEpochMs(result.town.createdAt);
        const familyClockStartAtMs = toEpochMs(result.town.familyClockStartAt);
        const serializedTown = {
          ...result.town,
          ...(createdAtMs !== undefined ? { createdAt: createdAtMs } : {}),
          ...(familyClockStartAtMs !== undefined
            ? { familyClockStartAt: familyClockStartAtMs }
            : {}),
          childBorn: Boolean(result.town.childBorn),
        };
        const walletBalance = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;
        res.status(200).json({ ...result, town: serializedTown, tiles, walletBalance });
        return;
      } catch (err: any) {
        if (err.message?.includes('disabled')) {
          res.status(403).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: err.message || 'Failed to initialize town' });
        return;
      }
    }

    if (method === 'GET' && pathname === '/town/catalog') {
      const db = getDb();
      const catalog = await getTownCatalog(db);
      res.status(200).json(catalog);
      return;
    }

    if (method === 'POST' && pathname === '/town/tutorial') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const step = Number(body.step);
      if (!Number.isFinite(step)) {
        res.status(400).json({ error: 'Invalid tutorial step' });
        return;
      }
      const db = getDb();
      try {
        const result = await setTutorialStep(db, uid, step);
        res.status(200).json(result);
        return;
      } catch (err: any) {
        if (err.message?.includes('TOWN_NOT_FOUND')) {
          res.status(404).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err.message || 'Failed to update tutorial step' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/build') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await buildItem(db, uid, {
          itemId: String(body.itemId ?? ''),
          x: Number(body.x),
          y: Number(body.y),
          rot: body.rot === 1 ? 1 : undefined,
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Build failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/move') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await moveTile(db, uid, {
          fromX: Number(body.fromX),
          fromY: Number(body.fromY),
          toX: Number(body.toX),
          toY: Number(body.toY),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Move failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/rotate') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await rotateTownElement(db, uid, {
          x: Number(body.x),
          y: Number(body.y),
          layer: body.layer === 'ground' ? 'ground' : body.layer === 'item' ? 'item' : ('' as any),
          rot: Number(body.rot),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Rotate failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/remove') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await removeTile(db, uid, {
          x: Number(body.x),
          y: Number(body.y),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Remove failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/buy-plot') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await buyFarmPlot(db, uid, {
          x: Number(body.x),
          y: Number(body.y),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Plot purchase failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/buy-land') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await buyLandTile(db, uid, {
          x: Number(body.x),
          y: Number(body.y),
          groundType: String(body.groundType ?? ''),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Land purchase failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/plant') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await plantCrop(db, uid, {
          x: Number(body.x),
          y: Number(body.y),
          cropId: String(body.cropId ?? ''),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Plant failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/harvest') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await harvestCrop(db, uid, {
          x: Number(body.x),
          y: Number(body.y),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Harvest failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/speedup') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await speedupCrop(db, uid, {
          x: Number(body.x),
          y: Number(body.y),
          expectedCost: body.expectedCost !== undefined ? Number(body.expectedCost) : undefined,
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        const msg = String(err?.message || 'Speed-up failed');
        if (msg.includes('disabled')) {
          res.status(403).json({ error: msg });
          return;
        }
        if (msg.includes('PRICE_CHANGED')) {
          res.status(409).json({ error: msg, code: 'PRICE_CHANGED' });
          return;
        }
        res.status(400).json({ error: msg });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/family-event/complete') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await completeFamilyEvent(db, uid);
        res.status(200).json(result);
        return;
      } catch (err: any) {
        const msg = String(err?.message || 'Family event completion failed');
        if (msg.includes('disabled')) {
          res.status(403).json({ error: msg });
          return;
        }
        if (msg.includes('NOT_YET')) {
          res.status(409).json({ error: msg, code: 'NOT_YET' });
          return;
        }
        if (msg.includes('TOWN_NOT_FOUND')) {
          res.status(404).json({ error: msg, code: 'TOWN_NOT_FOUND' });
          return;
        }
        res.status(400).json({ error: msg });
        return;
      }
    }

    if (method === 'GET' && pathname === '/town/orders') {
      const uid = String(url.searchParams.get('uid') ?? '');
      const roundDate = String(
        url.searchParams.get('date') ?? getLocalDateString(new Date(), 'UTC'),
      );
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await getOrCreateDailyOrders(db, uid, roundDate);
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Orders fetch failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/deliver-order') {
      const uid = String(body.uid ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await deliverOrder(db, uid, {
          roundDate: String(body.roundDate ?? getLocalDateString(new Date(), 'UTC')),
          orderId: String(body.orderId ?? ''),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Delivery failed' });
        return;
      }
    }

    if (method === 'GET' && pathname === '/town/inventory') {
      const uid = String(url.searchParams.get('uid') ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      const snap = await db
        .collection('users')
        .doc(uid)
        .collection('townInventory')
        .doc('main')
        .get();
      res.status(200).json(snap.exists ? snap.data() : { crops: {} });
      return;
    }

    if (method === 'GET' && pathname === '/town/visit') {
      const hostUid = String(url.searchParams.get('hostUid') ?? '');
      const viewerUid = String(url.searchParams.get('viewerUid') ?? '');
      if (!hostUid || !viewerUid || viewerUid === 'anon' || viewerUid === 'u_ssr') {
        res.status(401).json({ error: 'Missing hostUid or viewerUid' });
        return;
      }
      const db = getDb();
      try {
        const result = await getTownVisit(db, hostUid, viewerUid);
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Visit failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/like') {
      const hostUid = String(body.hostUid ?? '');
      const viewerUid = String(body.viewerUid ?? '');
      if (!hostUid || !viewerUid || viewerUid === 'anon' || viewerUid === 'u_ssr') {
        res.status(401).json({ error: 'Missing hostUid or viewerUid' });
        return;
      }
      const db = getDb();
      try {
        const result = await likeTown(db, hostUid, viewerUid);
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Like failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/checkout') {
      const uid = String(body.uid ?? '');
      const packId = String(body.packId ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res
          .status(401)
          .json({ error: 'Please sign in or link your account before purchasing coins' });
        return;
      }
      if (!packId) {
        res.status(400).json({ error: 'Missing packId' });
        return;
      }
      const db = getDb();
      try {
        const result = await createCoinCheckoutSession(db, {
          uid,
          packId,
          locale: body.locale ? String(body.locale) : undefined,
          publicBaseUrl: PUBLIC_BASE_URL.value(),
          successUrl: body.successUrl ? String(body.successUrl) : undefined,
          cancelUrl: body.cancelUrl ? String(body.cancelUrl) : undefined,
          simulateImmediately: Boolean(body.simulateImmediately),
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Checkout failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/stripe-webhook') {
      const db = getDb();
      const result = await handleStripeWebhook(
        {
          rawBody: req.rawBody,
          signature: readStripeSignatureHeader(req.headers['stripe-signature']),
        },
        {
          verifyStripeEvent,
          getStripe,
          getStoreUser: (uid) => getStore().users[uid],
          getUserFromFirestore,
          processStripeWebhook,
          handleTownStripeWebhook: (event) => handleTownStripeWebhook(db, event),
        },
      );
      res.status(result.status).json(result.body);
      return;
    }

    if (method === 'GET' && pathname === '/town/transfer-status') {
      const uid = String(url.searchParams.get('uid') ?? '');
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(401).json({ error: 'Missing uid' });
        return;
      }
      const db = getDb();
      try {
        const result = await getTransferStatus(db, uid);
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Status check failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/transfer') {
      const senderUid = String(body.senderUid ?? '');
      const receiverUid = String(body.receiverUid ?? '');
      const amount = Number(body.amount ?? 0);
      if (!senderUid || !receiverUid || senderUid === 'anon' || receiverUid === 'anon') {
        res.status(401).json({ error: 'Invalid sender or receiver' });
        return;
      }
      const db = getDb();
      try {
        const result = await transferCoins(db, {
          senderUid,
          receiverUid,
          amount,
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Transfer failed' });
        return;
      }
    }

    if (method === 'GET' && pathname === '/town/water-status') {
      const helperUid = String(url.searchParams.get('helperUid') ?? '');
      const hostUid = String(url.searchParams.get('hostUid') ?? '');
      if (!helperUid || !hostUid || helperUid === 'anon' || hostUid === 'anon') {
        res.status(401).json({ error: 'Missing helperUid or hostUid' });
        return;
      }
      const db = getDb();
      try {
        const result = await getFriendWaterStatus(db, helperUid, hostUid);
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Water status check failed' });
        return;
      }
    }

    if (method === 'POST' && pathname === '/town/water') {
      const helperUid = String(body.helperUid ?? '');
      const hostUid = String(body.hostUid ?? '');
      const tileX = Number(body.tileX ?? 0);
      const tileY = Number(body.tileY ?? 0);
      if (!helperUid || !hostUid || helperUid === 'anon' || hostUid === 'anon') {
        res.status(401).json({ error: 'Missing helperUid or hostUid' });
        return;
      }
      const db = getDb();
      try {
        const result = await waterFriendCrop(db, {
          helperUid,
          hostUid,
          tileX,
          tileY,
        });
        res.status(200).json(result);
        return;
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Water failed' });
        return;
      }
    }

    if (method === 'GET' && pathname === '/game/status') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      const tz = url.searchParams.get('tz') ?? 'UTC';
      const rawLeagues = url.searchParams.get('leagues');
      const clientLeagueIds = rawLeagues ? rawLeagues.split(',').filter(Boolean) : undefined;
      if (uid && uid !== 'anon' && uid !== 'u_ssr' && !getStore().users[uid]) {
        await getUserFromFirestore(uid);
      }
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
      const planRaw = body.plan ? String(body.plan) : undefined;
      const plan =
        planRaw === 'free' || planRaw === 'pro_trial' || planRaw === 'pro'
          ? (planRaw as 'free' | 'pro_trial' | 'pro')
          : undefined;
      const lg = createLeague({
        uid: String(body.uid),
        name: body.name ? String(body.name) : undefined,
        tz: String(body.tz ?? 'UTC'),
        locale: (body.locale as Locale) ?? 'en',
        themeEmoji: body.themeEmoji ? String(body.themeEmoji) : undefined,
        themeColor: body.themeColor ? String(body.themeColor) : undefined,
        plan,
      });
      res.status(200).json({
        leagueId: lg.id,
        name: lg.name,
        inviteCode: lg.inviteCode,
        themeEmoji: lg.themeEmoji,
        themeColor: lg.themeColor,
      });
      return;
    }

    const leagueJoinMatch = pathname.match(/^\/leagues\/([^/]+)\/join$/);
    if (method === 'POST' && leagueJoinMatch) {
      const codeOrId = decodeURIComponent(leagueJoinMatch[1]!);
      const inviteCodeParam = body.inviteCode || body.code;
      try {
        const lg = joinLeague({
          inviteCode: inviteCodeParam ? String(inviteCodeParam) : codeOrId,
          codeOrId,
          uid: String(body.uid),
          nickname: String(body.nickname),
          tz: String(body.tz ?? 'UTC'),
        });
        res.status(200).json({ leagueId: lg.id, name: lg.name, inviteCode: lg.inviteCode });
      } catch (e: any) {
        res.status(400).json({ error: e.message, code: e.code || 'BAD_REQUEST' });
      }
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
          if (body.action === 'regenerate_code') {
            const result = regenerateLeagueInviteCode({
              codeOrId: code,
              actorUid: String(body.actorUid),
            });
            res.status(200).json(result);
            return;
          }
          if (body.action === 'private_approval') {
            const result = setLeaguePrivateApproval({
              codeOrId: code,
              actorUid: String(body.actorUid),
              enabled: Boolean(body.enabled),
            });
            res.status(200).json(result);
            return;
          }
          if (body.action === 'rename' || typeof body.name === 'string') {
            const trimmed = String(body.name ?? '').trim();
            if (
              trimmed.length < 2 ||
              trimmed.length > 30 ||
              trimmed.toLowerCase() === 'undefined'
            ) {
              res.status(400).json({
                error: 'League name must be between 2 and 30 characters',
                code: 'LEAGUE_NAME_INVALID',
              });
              return;
            }
            const lg = renameLeague({
              codeOrId: code,
              actorUid: String(body.actorUid),
              name: trimmed,
            });
            res.status(200).json({ success: true, name: lg.name });
            return;
          }
          res.status(400).json({ error: 'Unknown action', code: 'BAD_REQUEST' });
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

    if (method === 'GET' && pathname === '/duels') {
      const uid = url.searchParams.get('uid') ?? 'anon';
      if (!uid || uid === 'anon' || uid === 'u_ssr') {
        res.status(400).json({ error: 'Missing uid' });
        return;
      }
      if (!getStore().users[uid]) {
        await getUserFromFirestore(uid);
      }
      res.status(200).json(getUserDuels(uid));
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
        try {
          await getAuth().updateUser(uid, { displayName: nickname });
        } catch {
          // Auth user might not exist or be anonymous
        }
        res.status(200).json(updated);
      } catch (err: any) {
        res.status(400).json({
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
      const result = await createProCheckout(
        {
          authHeader:
            typeof req.headers['authorization'] === 'string' ? req.headers['authorization'] : null,
          testUidHeader:
            typeof req.headers['x-test-uid'] === 'string' ? req.headers['x-test-uid'] : null,
          body,
        },
        {
          verifyIdToken: async (token) => getAuth().verifyIdToken(token),
          getStoreUser: (uid) => getStore().users[uid],
          getUserFromFirestore,
          getOrCreateUser,
          markUserDirty,
          syncUserToFirestore,
          processStripeWebhook,
          getStripe,
          priceIds: {
            monthly: STRIPE_PRICE_PRO_MONTHLY.value(),
            yearly: STRIPE_PRICE_PRO_YEARLY.value(),
          },
          publicBaseUrl: PUBLIC_BASE_URL.value(),
        },
      );
      res.status(result.status).json(result.body);
      return;
    }

    if (method === 'POST' && pathname === '/billing/webhook') {
      const db = getDb();
      const result = await handleStripeWebhook(
        {
          rawBody: req.rawBody,
          signature: readStripeSignatureHeader(req.headers['stripe-signature']),
        },
        {
          verifyStripeEvent,
          getStripe,
          getStoreUser: (uid) => getStore().users[uid],
          getUserFromFirestore,
          processStripeWebhook,
          handleTownStripeWebhook: (event) => handleTownStripeWebhook(db, event),
        },
      );
      res.status(result.status).json(result.body);
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

    if ((method === 'POST' || method === 'DELETE') && pathname === '/notify/token') {
      const db = getDb();
      const result = await handleNotifyTokenRequest(db, {
        method,
        authHeader: String(req.headers['authorization'] ?? ''),
        body,
        verifyIdToken: async (token) => getAuth().verifyIdToken(token),
      });
      res.status(result.status).json(result.body);
      return;
    }

    if (method === 'POST' && pathname === '/notify/test') {
      const db = getDb();
      const result = await handleNotifyTestRequest(db, {
        authHeader: String(req.headers['authorization'] ?? ''),
        body,
        verifyIdToken: async (token) => getAuth().verifyIdToken(token),
      });
      res.status(result.status).json(result.body);
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
  const db = getDb();
  const summary = await runHourlyReminders(db);
  console.log('[hourlyReminders] completed', summary);
  // TODO(push-phase-2): call notifyCropsReady from a harvest-ready scheduler when one exists.
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
    await storePersistence.ensureHydrated();
    await ensureUpcomingDailyRounds(7);
    await storePersistence.flushNow();
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
    await storePersistence.ensureHydrated();
    promoteReserveRoundIfNeeded(dateStr);
    await storePersistence.flushNow();
  },
);

/**
 * Scheduled Cloud Function (Cloud Scheduler, daily 04:00 Europe/Bucharest)
 * Automatically purges anonymous users whose 7-day retention period has passed.
 */
export const cleanupExpiredAnonymousUsers = onSchedule('every 24 hours', async () => {
  await storePersistence.ensureHydrated();
  const result = await purgeExpiredAnonymousUsers();
  await storePersistence.flushNow();
  console.log('[Firestore] Scheduled anonymous purge', result);
});

/**
 * RonTown award trigger: awards RonCoins when a daily round play document is written to store_plays/{docId}.
 */
export const awardTriviaCoins = onDocumentWritten(
  { document: 'store_plays/{docId}', region: 'europe-west1' },
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap || !afterSnap.exists) return;
    const data = afterSnap.data();
    if (!data || !data.v) return;
    const db = getDb();
    await processAwardTriviaCoins(db, data.v, event.params.docId);
  },
);

/**
 * Scheduled batched ledger reconciliation (daily at 03:00).
 */
export const reconcileLedgerJob = onSchedule('0 3 * * *', async () => {
  const db = getDb();
  let lastUid: string | undefined = undefined;
  let totalBatches = 0;
  let totalMismatches = 0;

  do {
    const res = await batchReconcileLedgers(db, 100, lastUid);
    totalBatches += 1;
    totalMismatches += res.mismatchCount;
    lastUid = res.lastUid ?? undefined;
  } while (lastUid && totalBatches < 50);

  console.log(
    `[reconcileLedgerJob] Completed ${totalBatches} batches, mismatches: ${totalMismatches}`,
  );
});

/**
 * RonTown initialization endpoint.
 * Idempotently provisions a player's town on first open.
 */
export const town_init = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in to initialize town');
  }
  const db = getDb();
  try {
    return await initPlayerTown(db, uid);
  } catch (err: any) {
    if (err.message?.includes('disabled')) {
      throw new HttpsError('failed-precondition', err.message);
    }
    throw new HttpsError('internal', err.message || 'Failed to initialize town');
  }
});
