import { beforeEach, describe, expect, it } from 'vitest';

import {
  getOrCreateUser,
  getStore,
  updateNotificationPrefs,
} from '../../apps/web/lib/server-store.js';
import {
  handleNotifyPrefsRequest,
  handleNotifyTestRequest,
  handleNotifyTokenRequest,
  hashPushToken,
  MAX_TOKENS_PER_USER,
  runHourlyReminders,
  sendPushToUser,
  type PushMessagingSender,
  type WebpushMulticastMessage,
} from './push.js';
import { clearEconomyConfigCache } from './town-economy.js';

function createMockDb(initial: Record<string, Record<string, unknown>> = {}) {
  const store = new Map<string, Record<string, unknown>>();
  for (const [k, v] of Object.entries(initial)) {
    store.set(k, structuredClone(v));
  }

  function makeDocRef(docPath: string) {
    return {
      id: docPath.split('/').pop()!,
      path: docPath,
      get: async () => {
        const data = store.get(docPath);
        return { id: docPath.split('/').pop()!, exists: data !== undefined, data: () => data };
      },
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        if (opts?.merge && store.has(docPath)) {
          store.set(docPath, { ...store.get(docPath)!, ...data });
        } else {
          store.set(docPath, { ...data });
        }
      },
      delete: async () => {
        store.delete(docPath);
      },
      collection: (subCol: string) => makeColRef(`${docPath}/${subCol}`),
    };
  }

  function makeColRef(colPath: string) {
    const getAllDocs = () => {
      const prefix = `${colPath}/`;
      const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
      for (const [key, val] of store.entries()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        if (rest.includes('/')) continue; // direct children only
        docs.push({ id: rest, data: () => val });
      }
      docs.sort((a, b) => a.id.localeCompare(b.id));
      return docs;
    };

    const makeQuery = (
      filters: Array<{ field: string; value: unknown }> = [],
      afterId: string | null = null,
      limitCount = 1000,
    ) => ({
      where: (field: string, _op: string, value: unknown) =>
        makeQuery([...filters, { field, value }], afterId, limitCount),
      orderBy: () => makeQuery(filters, afterId, limitCount),
      limit: (n: number) => makeQuery(filters, afterId, n),
      startAfter: (doc: { id: string }) => makeQuery(filters, doc.id, limitCount),
      get: async () => {
        let docs = getAllDocs().filter((d) => {
          const data = d.data();
          return filters.every(({ field, value }) => {
            const parts = field.split('.');
            let cur: unknown = data;
            for (const p of parts) {
              cur =
                cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
            }
            return cur === value;
          });
        });
        if (afterId) {
          docs = docs.filter((d) => d.id > afterId);
        }
        docs = docs.slice(0, limitCount);
        return { empty: docs.length === 0, docs };
      },
    });

    return {
      doc: (id: string) => makeDocRef(`${colPath}/${id}`),
      get: async () => {
        const docs = getAllDocs();
        return { empty: docs.length === 0, docs };
      },
      where: (field: string, op: string, value: unknown) => makeQuery([{ field, value }]),
    };
  }

  const db = {
    collection: (col: string) => makeColRef(col),
  } as unknown as import('firebase-admin/firestore').Firestore;

  return { db, store };
}

describe('functions/src/push.ts', () => {
  beforeEach(() => {
    clearEconomyConfigCache();
  });

  it('sends data-only webpush payload and deletes invalid/unregistered tokens', async () => {
    const goodTok = 'tok_good_1234567890';
    const deadTok = 'tok_dead_1234567890';
    const badArgTok = 'tok_bad_1234567890';
    const goodId = hashPushToken(goodTok);
    const deadId = hashPushToken(deadTok);
    const badArgId = hashPushToken(badArgTok);

    const { db, store } = createMockDb({
      'users/u1': {
        uid: 'u1',
        locale: 'en',
        tz: 'UTC',
        notif: {
          pushEnabled: true,
          emailEnabled: false,
          reminderLocalTime: '18:00',
          sentTodayCount: 0,
        },
      },
      [`users/u1/pushTokens/${goodId}`]: { token: goodTok, platform: 'android', locale: 'en' },
      [`users/u1/pushTokens/${deadId}`]: { token: deadTok, platform: 'android', locale: 'en' },
      [`users/u1/pushTokens/${badArgId}`]: { token: badArgTok, platform: 'ios', locale: 'en' },
    });

    const sent: WebpushMulticastMessage[] = [];
    const mockMessaging: PushMessagingSender = {
      sendEachForMulticast: async (msg) => {
        sent.push(msg);
        return {
          successCount: 1,
          failureCount: 2,
          responses: msg.tokens.map((t) => {
            if (t === deadTok) {
              return {
                success: false,
                error: { code: 'messaging/registration-token-not-registered' },
              };
            }
            if (t === badArgTok) {
              return { success: false, error: { code: 'messaging/invalid-argument' } };
            }
            return { success: true };
          }),
        };
      },
    };

    const res = await sendPushToUser(
      db,
      'u1',
      {
        title: 'Hello',
        body: 'World',
        url: '/en',
        tag: 'daily',
        type: 'daily_reminder',
      },
      { now: new Date('2026-11-26T18:15:00Z'), customMessaging: mockMessaging },
    );

    expect(res.sent).toBe(true);
    expect(res.count).toBe(1);
    expect(res.removedTokens).toBe(2);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.webpush?.headers).toEqual({ Urgency: 'high', TTL: '3600' });
    expect(sent[0]!.webpush?.data?.title).toBe('Hello');
    expect(sent[0]!.webpush?.fcmOptions?.link).toBe('/en');
    // Strictly data-only (no top-level notification object)
    expect('notification' in sent[0]!).toBe(false);

    // Invalid tokens deleted, valid token retained
    expect(store.has(`users/u1/pushTokens/${goodId}`)).toBe(true);
    expect(store.has(`users/u1/pushTokens/${deadId}`)).toBe(false);
    expect(store.has(`users/u1/pushTokens/${badArgId}`)).toBe(false);
  });

  it('respects the per-day notification cap and skips daily reminders when already played today', async () => {
    const tok = 'tok_cap_1234567890';
    const { db } = createMockDb({
      'users/u_capped': {
        uid: 'u_capped',
        tz: 'UTC',
        notif: {
          pushEnabled: true,
          sentTodayDate: '2026-11-26',
          sentTodayCount: 2,
        },
      },
      [`users/u_capped/pushTokens/${hashPushToken(tok)}`]: { token: tok },
      'users/u_played': {
        uid: 'u_played',
        tz: 'UTC',
        lastPlayedDate: '2026-11-26',
        notif: {
          pushEnabled: true,
          sentTodayDate: '2026-11-26',
          sentTodayCount: 0,
        },
      },
      [`users/u_played/pushTokens/${hashPushToken(tok)}`]: { token: tok },
    });

    const sent: WebpushMulticastMessage[] = [];
    const mockMessaging: PushMessagingSender = {
      sendEachForMulticast: async (m) => {
        sent.push(m);
        return { successCount: 1, failureCount: 0 };
      },
    };

    const now = new Date('2026-11-26T18:15:00Z');
    const cappedRes = await sendPushToUser(
      db,
      'u_capped',
      { title: 'T', body: 'B', url: '/en', tag: 'x', type: 'daily_reminder' },
      { now, customMessaging: mockMessaging },
    );
    expect(cappedRes.sent).toBe(false);
    expect(cappedRes.reason).toBe('daily_cap_reached');

    const playedRes = await sendPushToUser(
      db,
      'u_played',
      { title: 'T', body: 'B', url: '/en', tag: 'x', type: 'daily_reminder' },
      { now, customMessaging: mockMessaging },
    );
    expect(playedRes.sent).toBe(false);
    expect(playedRes.reason).toBe('already_played_today');
    expect(sent).toHaveLength(0);
  });

  it('/notify/token rejects missing or invalid ID token, trusts only verified uid, and caps at 10 tokens', async () => {
    const { db, store } = createMockDb({});
    const verifyValid = async (t: string) => {
      if (t === 'good_id_token') return { uid: 'uid_verified' };
      throw new Error('invalid');
    };

    // Missing header -> 401
    const rMissing = await handleNotifyTokenRequest(db, {
      method: 'POST',
      authHeader: '',
      body: { token: 'fcm_token_abcdefghij' },
      verifyIdToken: verifyValid,
    });
    expect(rMissing.status).toBe(401);

    // Invalid token -> 401
    const rInvalid = await handleNotifyTokenRequest(db, {
      method: 'POST',
      authHeader: 'Bearer bad_token',
      body: { token: 'fcm_token_abcdefghij' },
      verifyIdToken: verifyValid,
    });
    expect(rInvalid.status).toBe(401);

    // Valid token -> writes under verified uid (ignoring spoofed body.uid) and caps at 10
    for (let i = 0; i < MAX_TOKENS_PER_USER + 2; i += 1) {
      const res = await handleNotifyTokenRequest(db, {
        method: 'POST',
        authHeader: 'Bearer good_id_token',
        body: {
          uid: 'spoofed_other_uid',
          token: `fcm_token_device_${String(i).padStart(4, '0')}`,
          platform: 'android',
          locale: 'ro',
        },
        verifyIdToken: verifyValid,
        now: new Date(Date.UTC(2026, 10, 26, 10, i, 0)),
      });
      expect(res.status).toBe(200);
    }

    const savedKeys = Array.from(store.keys()).filter((k) =>
      k.startsWith('users/uid_verified/pushTokens/'),
    );
    expect(savedKeys).toHaveLength(MAX_TOKENS_PER_USER);
    expect(Array.from(store.keys()).some((k) => k.startsWith('users/spoofed_other_uid/'))).toBe(
      false,
    );

    // DELETE removes the specified token
    const delRes = await handleNotifyTokenRequest(db, {
      method: 'DELETE',
      authHeader: 'Bearer good_id_token',
      body: { token: `fcm_token_device_${String(MAX_TOKENS_PER_USER + 1).padStart(4, '0')}` },
      verifyIdToken: verifyValid,
    });
    expect(delRes.status).toBe(200);
    const remaining = Array.from(store.keys()).filter((k) =>
      k.startsWith('users/uid_verified/pushTokens/'),
    );
    expect(remaining).toHaveLength(MAX_TOKENS_PER_USER - 1);
  });

  it('/notify/test sends localized test notification and enforces 3/hour rate limit', async () => {
    const tok = 'fcm_test_token_12345';
    const { db } = createMockDb({
      'users/u_ro': {
        uid: 'u_ro',
        locale: 'ro',
        tz: 'Europe/Bucharest',
        notif: { pushEnabled: true },
      },
      [`users/u_ro/pushTokens/${hashPushToken(tok)}`]: { token: tok },
    });
    const sent: WebpushMulticastMessage[] = [];
    const mockMessaging: PushMessagingSender = {
      sendEachForMulticast: async (m) => {
        sent.push(m);
        return { successCount: 1, failureCount: 0 };
      },
    };
    const verify = async () => ({ uid: 'u_ro' });
    const now = new Date('2026-11-26T15:00:00Z');

    for (let i = 0; i < 3; i += 1) {
      const r = await handleNotifyTestRequest(db, {
        authHeader: 'Bearer ok',
        body: {},
        verifyIdToken: verify,
        now,
        customMessaging: mockMessaging,
      });
      expect(r.status).toBe(200);
      expect(r.body.sent).toBe(true);
    }
    expect(sent[0]!.webpush?.data?.title).toBe('Test RonDuel 🔔');

    // 4th within the hour -> 429
    const r4 = await handleNotifyTestRequest(db, {
      authHeader: 'Bearer ok',
      body: {},
      verifyIdToken: verify,
      now: new Date(now.getTime() + 10_000),
      customMessaging: mockMessaging,
    });
    expect(r4.status).toBe(429);
  });

  it('runHourlyReminders sends only to users whose local hour matches reminderLocalTime and who have not played today', async () => {
    const tok = 'fcm_hourly_token_12345';
    // At 17:15 UTC: Europe/Oslo (UTC+1) is 18:15, America/New_York (UTC-5) is 12:15
    const now = new Date('2026-11-26T17:15:00Z');
    const { db } = createMockDb({
      'users/u_oslo_due': {
        uid: 'u_oslo_due',
        locale: 'nb',
        tz: 'Europe/Oslo',
        lastPlayedDate: '2026-11-25',
        notif: { pushEnabled: true, reminderLocalTime: '18:00' },
      },
      [`users/u_oslo_due/pushTokens/${hashPushToken(tok)}`]: { token: tok },
      'users/u_oslo_played': {
        uid: 'u_oslo_played',
        locale: 'nb',
        tz: 'Europe/Oslo',
        lastPlayedDate: '2026-11-26',
        notif: { pushEnabled: true, reminderLocalTime: '18:00' },
      },
      [`users/u_oslo_played/pushTokens/${hashPushToken(tok)}`]: { token: tok },
      'users/u_ny_not_due': {
        uid: 'u_ny_not_due',
        locale: 'en',
        tz: 'America/New_York',
        lastPlayedDate: '2026-11-25',
        notif: { pushEnabled: true, reminderLocalTime: '18:00' },
      },
      [`users/u_ny_not_due/pushTokens/${hashPushToken(tok)}`]: { token: tok },
    });

    const sent: WebpushMulticastMessage[] = [];
    const mockMessaging: PushMessagingSender = {
      sendEachForMulticast: async (m) => {
        sent.push(m);
        return { successCount: 1, failureCount: 0 };
      },
    };

    const summary = await runHourlyReminders(db, now, mockMessaging);
    expect(summary).toEqual({ scanned: 3, sent: 1, skipped: 2 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.webpush?.data?.title).toBe('Dagens runde venter ⚡');
    expect(sent[0]!.webpush?.data?.url).toBe('/nb');
  });

  it('/notify/prefs enforces Bearer auth (401), uid match (403), EMAIL_ACCOUNT_REQUIRED (400), and reloads stale user from Firestore', async () => {
    const store = getStore();
    delete store.users['u_prefs_anon'];
    delete store.users['u_prefs_stale'];

    const synced: string[] = [];
    const verify = async (token: string) => {
      if (token === 'tok_anon') return { uid: 'u_prefs_anon' };
      if (token === 'tok_linked') {
        return { uid: 'u_prefs_stale', email: 'player@example.com' };
      }
      throw new Error('invalid');
    };

    // 1. Missing Bearer -> 401
    const rMissing = await handleNotifyPrefsRequest({
      authHeader: '',
      body: { pushEnabled: true, emailEnabled: false },
      verifyIdToken: verify,
      getUser: (uid) => store.users[uid],
      getUserFromFirestore: async () => null,
      updateNotificationPrefs,
      syncUserToFirestore: async (uid) => {
        synced.push(uid);
      },
    });
    expect(rMissing.status).toBe(401);
    expect(rMissing.body.code).toBe('UNAUTHORIZED');

    // 2. uid mismatch -> 403
    const rMismatch = await handleNotifyPrefsRequest({
      authHeader: 'Bearer tok_anon',
      body: { uid: 'u_someone_else', pushEnabled: true, emailEnabled: false },
      verifyIdToken: verify,
      getUser: (uid) => store.users[uid],
      getUserFromFirestore: async () => null,
      updateNotificationPrefs,
      syncUserToFirestore: async (uid) => {
        synced.push(uid);
      },
    });
    expect(rMismatch.status).toBe(403);
    expect(rMismatch.body.code).toBe('FORBIDDEN');

    // 3. Anonymous user + emailEnabled -> 400 EMAIL_ACCOUNT_REQUIRED
    getOrCreateUser({ uid: 'u_prefs_anon' });
    const rAnonEmail = await handleNotifyPrefsRequest({
      authHeader: 'Bearer tok_anon',
      body: { uid: 'u_prefs_anon', pushEnabled: false, emailEnabled: true },
      verifyIdToken: verify,
      getUser: (uid) => store.users[uid],
      getUserFromFirestore: async () => null,
      updateNotificationPrefs,
      syncUserToFirestore: async (uid) => {
        synced.push(uid);
      },
    });
    expect(rAnonEmail.status).toBe(400);
    expect(rAnonEmail.body.code).toBe('EMAIL_ACCOUNT_REQUIRED');

    // 4. Stale in-memory anonymous user whose verified token has email -> reloads from Firestore and succeeds (200)
    const staleUser = getOrCreateUser({ uid: 'u_prefs_stale' });
    expect(staleUser.isAnonymous).toBe(true);
    let reloadedFromFirestore = false;
    const rReloaded = await handleNotifyPrefsRequest({
      authHeader: 'Bearer tok_linked',
      body: {
        uid: 'u_prefs_stale',
        pushEnabled: false,
        emailEnabled: true,
        reminderLocalTime: '19:00',
      },
      verifyIdToken: verify,
      getUser: (uid) => store.users[uid],
      getUserFromFirestore: async (uid) => {
        reloadedFromFirestore = true;
        store.users[uid] = {
          ...staleUser,
          isAnonymous: false,
          email: 'player@example.com',
        };
        return store.users[uid]!;
      },
      updateNotificationPrefs,
      syncUserToFirestore: async (uid) => {
        synced.push(uid);
      },
    });
    expect(reloadedFromFirestore).toBe(true);
    expect(rReloaded.status).toBe(200);
    expect(rReloaded.body.emailEnabled).toBe(true);
    expect(rReloaded.body.reminderLocalTime).toBe('19:00');
    expect(synced).toContain('u_prefs_stale');
  });
});
