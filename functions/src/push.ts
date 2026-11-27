import { createHash } from 'node:crypto';

import { getLocalDateString, shouldSendNotification } from '@ronduel/shared';
import type { Firestore } from 'firebase-admin/firestore';

import { getServerPushCopy } from './push-i18n.js';
import { getTownEconomyConfig } from './town-economy.js';

export type PushNotificationType =
  'daily_reminder' | 'duel_challenge' | 'weekly_winner' | 'town_crops_ready' | 'test';

export interface PushMessageInput {
  title: string;
  body: string;
  url: string;
  tag: string;
  type: PushNotificationType;
  extraData?: Record<string, string>;
}

export interface MulticastSendResponse {
  successCount: number;
  failureCount: number;
  responses?: Array<{
    success: boolean;
    error?: { code?: string; message?: string };
  }>;
}

export interface WebpushMulticastMessage {
  tokens: string[];
  data?: Record<string, string>;
  webpush?: {
    headers?: Record<string, string>;
    data?: Record<string, string>;
    fcmOptions?: { link?: string };
  };
}

export interface PushMessagingSender {
  sendEachForMulticast(message: WebpushMulticastMessage): Promise<MulticastSendResponse>;
}

export interface SendPushResult {
  sent: boolean;
  reason?: string;
  count?: number;
  removedTokens?: number;
}

export const MAX_TOKENS_PER_USER = 10;
export const TEST_PUSH_HOURLY_LIMIT = 3;
export const REMINDER_PAGE_SIZE = 300;

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
  'messaging/invalid-registration-token',
  'invalid-argument',
]);

export function hashPushToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getLocalHour(now: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const h = Number(hourPart);
    return Number.isFinite(h) ? h % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

function parseReminderHour(reminderLocalTime: unknown): number {
  if (typeof reminderLocalTime !== 'string') return 18;
  const match = reminderLocalTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 18;
  const hour = Number(match[1]);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 18;
}

function isUserPushOptedOut(
  userData: Record<string, unknown>,
  type: PushNotificationType,
): boolean {
  if (userData.notif === false) return true;
  const notifObj = (userData.notif ?? userData.notificationPrefs ?? userData.notifications) as
    Record<string, unknown> | undefined;

  if (type === 'test') {
    // Allow test sends right after enabling even if prefs doc sync is racing, unless explicitly false
    return false;
  }
  if (notifObj && notifObj.pushEnabled === false) return true;
  if (type === 'daily_reminder' && (!notifObj || notifObj.pushEnabled !== true)) return true;
  return false;
}

export async function sendPushToUser(
  db: Firestore,
  uid: string,
  payload: PushMessageInput,
  opts: {
    now?: Date;
    customMessaging?: PushMessagingSender;
  } = {},
): Promise<SendPushResult> {
  if (!uid || uid === 'anon' || uid === 'u_ssr') {
    return { sent: false, reason: 'invalid_uid' };
  }

  const now = opts.now ?? new Date();

  // 1. Respect RonTown kill switch for town notifications
  if (payload.type.startsWith('town_')) {
    const economy = await getTownEconomyConfig(db);
    if (!economy.enabled) {
      return { sent: false, reason: 'town_economy_disabled' };
    }
  }

  // 2. Fetch user document & check preferences + daily cap
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { sent: false, reason: 'user_not_found' };
  }
  const userData = (userSnap.data() || {}) as Record<string, unknown>;

  if (isUserPushOptedOut(userData, payload.type)) {
    return { sent: false, reason: 'user_opted_out' };
  }

  const tz = typeof userData.tz === 'string' && userData.tz ? userData.tz : 'UTC';
  const todayLocalDate = getLocalDateString(now, tz);
  const notifObj = (
    userData.notif && typeof userData.notif === 'object' ? userData.notif : {}
  ) as Record<string, unknown>;
  const sentTodayCount =
    notifObj.sentTodayDate === todayLocalDate && typeof notifObj.sentTodayCount === 'number'
      ? notifObj.sentTodayCount
      : 0;
  const playedToday = userData.lastPlayedDate === todayLocalDate;

  if (payload.type !== 'test') {
    const decision = shouldSendNotification({
      type:
        payload.type === 'daily_reminder' ||
        payload.type === 'duel_challenge' ||
        payload.type === 'weekly_winner'
          ? payload.type
          : 'weekly_winner',
      playedToday,
      sentTodayCount,
      pushEnabled: true,
      emailEnabled: false,
    });
    if (!decision.send) {
      return { sent: false, reason: decision.reason ?? 'suppressed' };
    }
  }

  // 3. Collect tokens from legacy array and users/{uid}/pushTokens subcollection
  const tokenToDocId = new Map<string, string | null>();
  const legacyTokens: string[] = [];

  if (Array.isArray(userData.pushTokens)) {
    for (const raw of userData.pushTokens) {
      if (typeof raw === 'string' && raw.length > 0 && !tokenToDocId.has(raw)) {
        tokenToDocId.set(raw, null);
        legacyTokens.push(raw);
      }
    }
  }

  const tokensCol = userRef.collection('pushTokens');
  const tokensSubSnap = await tokensCol.get();
  if (!tokensSubSnap.empty) {
    for (const doc of tokensSubSnap.docs) {
      const data = doc.data() as { token?: unknown } | undefined;
      const tok = typeof data?.token === 'string' && data.token.length > 0 ? data.token : doc.id;
      if (typeof tok === 'string' && tok.length > 0) {
        tokenToDocId.set(tok, doc.id);
      }
    }
  }

  const tokens = Array.from(tokenToDocId.keys());
  if (tokens.length === 0) {
    return { sent: false, reason: 'no_tokens_found' };
  }

  // 4. Send data-only webpush multicast message
  const dataPayload: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    type: payload.type,
    ...(payload.extraData ?? {}),
  };

  const message: WebpushMulticastMessage = {
    tokens,
    data: dataPayload,
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '3600',
      },
      data: dataPayload,
      fcmOptions: {
        link: payload.url,
      },
    },
  };

  try {
    let messaging = opts.customMessaging;
    if (!messaging) {
      const { getMessaging } = await import('firebase-admin/messaging');
      messaging = getMessaging() as unknown as PushMessagingSender;
    }

    const response = await messaging.sendEachForMulticast(message);

    // 5. Delete invalid / unregistered tokens
    let removedTokens = 0;
    const invalidTokens = new Set<string>();
    if (Array.isArray(response.responses)) {
      for (let i = 0; i < response.responses.length; i += 1) {
        const res = response.responses[i];
        const token = tokens[i];
        if (!res || res.success || !token) continue;
        const code = res.error?.code ?? '';
        if (INVALID_TOKEN_CODES.has(code)) {
          invalidTokens.add(token);
          const docId = tokenToDocId.get(token);
          if (docId && typeof tokensCol.doc === 'function') {
            try {
              await tokensCol.doc(docId).delete();
              removedTokens += 1;
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      }
    }

    // Prune invalid tokens from legacy array if present
    if (invalidTokens.size > 0 && legacyTokens.length > 0 && typeof userRef.set === 'function') {
      const remainingLegacy = legacyTokens.filter((t) => !invalidTokens.has(t));
      if (remainingLegacy.length !== legacyTokens.length) {
        try {
          await userRef.set({ pushTokens: remainingLegacy }, { merge: true });
        } catch {
          // Ignore legacy cleanup errors
        }
      }
    }

    // 6. Track per-day sent count for non-test pushes
    if (response.successCount > 0 && payload.type !== 'test' && typeof userRef.set === 'function') {
      try {
        await userRef.set(
          {
            notif: {
              ...notifObj,
              sentTodayDate: todayLocalDate,
              sentTodayCount: sentTodayCount + 1,
            },
          },
          { merge: true },
        );
      } catch {
        // Non-fatal counter update
      }
    }

    return {
      sent: response.successCount > 0,
      count: response.successCount,
      removedTokens,
      reason: response.successCount > 0 ? undefined : 'all_deliveries_failed',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'send_failed';
    console.error(`[sendPushToUser] Failed for uid=${uid}:`, err);
    return { sent: false, reason: msg };
  }
}

export async function upsertPushToken(
  db: Firestore,
  uid: string,
  input: { token: string; platform: string; locale: string },
  now: Date = new Date(),
): Promise<{ tokenId: string; pruned: number }> {
  const tokenId = hashPushToken(input.token);
  const col = db.collection('users').doc(uid).collection('pushTokens');
  const ref = col.doc(tokenId);
  const existing = await ref.get();
  const isoNow = now.toISOString();
  const createdAt =
    existing.exists && typeof existing.data()?.createdAt === 'string'
      ? String(existing.data()?.createdAt)
      : isoNow;

  await ref.set(
    {
      token: input.token,
      platform: input.platform,
      locale: input.locale,
      createdAt,
      lastSeenAt: isoNow,
    },
    { merge: true },
  );

  // Enforce max 10 tokens per user (drop oldest by lastSeenAt/createdAt)
  let pruned = 0;
  const allSnap = await col.get();
  if (allSnap.docs.length > MAX_TOKENS_PER_USER) {
    const sorted = [...allSnap.docs].sort((a, b) => {
      const aData = a.data() as { lastSeenAt?: string; createdAt?: string } | undefined;
      const bData = b.data() as { lastSeenAt?: string; createdAt?: string } | undefined;
      const aTs = aData?.lastSeenAt || aData?.createdAt || '';
      const bTs = bData?.lastSeenAt || bData?.createdAt || '';
      return aTs.localeCompare(bTs);
    });
    const toDrop = sorted.slice(0, sorted.length - MAX_TOKENS_PER_USER);
    for (const doc of toDrop) {
      if (doc.id === tokenId) continue;
      await col.doc(doc.id).delete();
      pruned += 1;
    }
  }

  return { tokenId, pruned };
}

export async function deletePushToken(
  db: Firestore,
  uid: string,
  token: string,
): Promise<{ deleted: boolean }> {
  const tokenId = hashPushToken(token);
  const ref = db.collection('users').doc(uid).collection('pushTokens').doc(tokenId);
  await ref.delete();
  return { deleted: true };
}

export async function verifyBearerToken(
  authHeader: string | undefined,
  verifyIdToken: (token: string) => Promise<{ uid: string; email?: string }>,
): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    if (!decoded?.uid) return null;
    return {
      uid: String(decoded.uid),
      email: typeof decoded.email === 'string' && decoded.email ? decoded.email : undefined,
    };
  } catch {
    return null;
  }
}

export async function verifyBearerUid(
  authHeader: string | undefined,
  verifyIdToken: (token: string) => Promise<{ uid: string }>,
): Promise<string | null> {
  const decoded = await verifyBearerToken(authHeader, verifyIdToken);
  return decoded?.uid ?? null;
}

export async function handleNotifyPrefsRequest(params: {
  authHeader?: string;
  body: Record<string, unknown>;
  verifyIdToken: (token: string) => Promise<{ uid: string; email?: string }>;
  getUser: (uid: string) => { isAnonymous?: boolean; email?: string } | undefined;
  getUserFromFirestore: (uid: string) => Promise<{ isAnonymous?: boolean; email?: string } | null>;
  updateNotificationPrefs: (input: {
    uid: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
    reminderLocalTime: string;
  }) => Record<string, unknown>;
  syncUserToFirestore: (uid: string) => Promise<void>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const decoded = await verifyBearerToken(params.authHeader, params.verifyIdToken);
  if (!decoded) {
    return { status: 401, body: { error: 'Unauthorized', code: 'UNAUTHORIZED' } };
  }

  const rawBodyUid = params.body.uid;
  if (rawBodyUid !== undefined && rawBodyUid !== null && String(rawBodyUid).trim() !== '') {
    if (String(rawBodyUid) !== decoded.uid) {
      return { status: 403, body: { error: 'Forbidden', code: 'FORBIDDEN' } };
    }
  }

  const uid = decoded.uid;
  const pushEnabled = Boolean(params.body.pushEnabled);
  const emailEnabled = Boolean(params.body.emailEnabled);
  const rawTime =
    typeof params.body.reminderLocalTime === 'string' &&
    /^\d{2}:\d{2}$/.test(params.body.reminderLocalTime)
      ? params.body.reminderLocalTime
      : '18:00';

  if (emailEnabled) {
    const existing = params.getUser(uid);
    if (!existing || (existing.isAnonymous && Boolean(decoded.email))) {
      await params.getUserFromFirestore(uid);
    }
  }

  try {
    const prefs = params.updateNotificationPrefs({
      uid,
      pushEnabled,
      emailEnabled,
      reminderLocalTime: rawTime,
    });
    await params.syncUserToFirestore(uid);
    return { status: 200, body: prefs };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || 'BAD_REQUEST';
    return {
      status: 400,
      body: {
        error: err instanceof Error ? err.message : 'Bad request',
        code,
      },
    };
  }
}

export async function handleNotifyTokenRequest(
  db: Firestore,
  params: {
    method: 'POST' | 'DELETE';
    authHeader?: string;
    body: Record<string, unknown>;
    verifyIdToken: (token: string) => Promise<{ uid: string }>;
    now?: Date;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const uid = await verifyBearerUid(params.authHeader, params.verifyIdToken);
  if (!uid) {
    return { status: 401, body: { error: 'Unauthorized', code: 'UNAUTHORIZED' } };
  }

  const rawToken = typeof params.body.token === 'string' ? params.body.token.trim() : '';
  if (!rawToken || rawToken.length < 10) {
    return { status: 400, body: { error: 'Invalid push token', code: 'INVALID_TOKEN' } };
  }

  if (params.method === 'DELETE') {
    await deletePushToken(db, uid, rawToken);
    return { status: 200, body: { ok: true } };
  }

  const rawPlatform = typeof params.body.platform === 'string' ? params.body.platform : 'desktop';
  const platform =
    rawPlatform === 'android' || rawPlatform === 'ios' || rawPlatform === 'desktop'
      ? rawPlatform
      : 'desktop';
  const locale =
    typeof params.body.locale === 'string' && params.body.locale.trim()
      ? params.body.locale.trim().slice(0, 8)
      : 'en';

  const result = await upsertPushToken(db, uid, { token: rawToken, platform, locale }, params.now);
  return { status: 200, body: { ok: true, tokenId: result.tokenId, pruned: result.pruned } };
}

export async function handleNotifyTestRequest(
  db: Firestore,
  params: {
    authHeader?: string;
    body: Record<string, unknown>;
    verifyIdToken: (token: string) => Promise<{ uid: string }>;
    now?: Date;
    customMessaging?: PushMessagingSender;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const uid = await verifyBearerUid(params.authHeader, params.verifyIdToken);
  if (!uid) {
    return { status: 401, body: { error: 'Unauthorized', code: 'UNAUTHORIZED' } };
  }

  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const oneHourAgo = nowMs - 60 * 60 * 1000;

  // Rate limit: max 3 test pushes per hour per uid
  const rateRef = db.collection('users').doc(uid).collection('pushMeta').doc('testRate');
  const rateSnap = await rateRef.get();
  const prevTimestamps = Array.isArray(rateSnap.data()?.timestamps)
    ? (rateSnap.data()?.timestamps as unknown[]).filter(
        (ts): ts is number => typeof ts === 'number' && ts > oneHourAgo,
      )
    : [];

  if (prevTimestamps.length >= TEST_PUSH_HOURLY_LIMIT) {
    return {
      status: 429,
      body: {
        error: 'Rate limit exceeded (max 3 test notifications per hour)',
        code: 'RATE_LIMITED',
      },
    };
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = (userSnap.data() || {}) as Record<string, unknown>;
  const locale =
    (typeof params.body.locale === 'string' && params.body.locale.trim()) ||
    (typeof userData.locale === 'string' && userData.locale) ||
    'en';
  const copy = getServerPushCopy(locale);

  const sendResult = await sendPushToUser(
    db,
    uid,
    {
      title: copy.testTitle,
      body: copy.testBody,
      url: `/${locale.slice(0, 2)}`,
      tag: 'ronduel-test',
      type: 'test',
    },
    { now, customMessaging: params.customMessaging },
  );

  await rateRef.set({ timestamps: [...prevTimestamps, nowMs] }, { merge: true });

  if (!sendResult.sent) {
    return {
      status: 200,
      body: { ok: false, sent: false, reason: sendResult.reason ?? 'not_sent' },
    };
  }

  return { status: 200, body: { ok: true, sent: true, count: sendResult.count ?? 1 } };
}

/**
 * Hourly reminder runner: queries users with `notif.pushEnabled == true` in pages of 300,
 * checks if their local hour matches `notif.reminderLocalTime`, and sends a daily reminder
 * if they haven't played today and are under the daily cap.
 */
export async function runHourlyReminders(
  db: Firestore,
  now: Date = new Date(),
  customMessaging?: PushMessagingSender,
): Promise<{ scanned: number; sent: number; skipped: number }> {
  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  let lastDoc: unknown = null;

  for (;;) {
    let query = db
      .collection('users')
      .where('notif.pushEnabled', '==', true)
      .orderBy('__name__')
      .limit(REMINDER_PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      const uid = doc.id;
      const userData = (doc.data() || {}) as Record<string, unknown>;
      const tz = typeof userData.tz === 'string' && userData.tz ? userData.tz : 'UTC';
      const notifObj = (
        userData.notif && typeof userData.notif === 'object' ? userData.notif : {}
      ) as Record<string, unknown>;

      const targetHour = parseReminderHour(notifObj.reminderLocalTime);
      const localHour = getLocalHour(now, tz);
      if (localHour !== targetHour) {
        skipped += 1;
        continue;
      }

      const locale =
        typeof userData.locale === 'string' && userData.locale ? userData.locale : 'en';
      const copy = getServerPushCopy(locale);
      const todayLocalDate = getLocalDateString(now, tz);

      const res = await sendPushToUser(
        db,
        uid,
        {
          title: copy.reminderTitle,
          body: copy.reminderBody,
          url: `/${locale.slice(0, 2)}`,
          tag: `daily-reminder-${todayLocalDate}`,
          type: 'daily_reminder',
        },
        { now, customMessaging },
      );

      if (res.sent) sent += 1;
      else skipped += 1;
    }

    if (snap.docs.length < REMINDER_PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { scanned, sent, skipped };
}
