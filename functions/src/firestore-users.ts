import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Query } from 'firebase-admin/firestore';

import {
  parseExpiresAt,
  runAnonymousPurge,
  type PurgeCandidate,
} from '../../apps/web/lib/anon-retention.js';
import { formatUserDoc as buildUserDoc } from '../../apps/web/lib/user-doc.js';
import {
  adoptAnonymousUid,
  backfillLeagueNicknamesFromUsers,
  consumeDirtyUsers,
  getStore,
  isPlaceholderNickname,
  markUserDirty,
  purgeAnonymousFromStore,
  syncNicknameToLeagues,
  type UserRecord,
} from '../../apps/web/lib/server-store.js';

export { ANON_RETENTION_DAYS } from '../../apps/web/lib/anon-retention.js';

const PURGE_BATCH = 400;
let usersHydrationPromise: Promise<void> | null = null;

export function getDb() {
  return getFirestore();
}

function toTimestamp(value: Date | null): Timestamp | null {
  return value ? Timestamp.fromDate(value) : null;
}

/**
 * Firestore shape of a user. Anonymous expiresAt is a Timestamp
 * (createdAt + 7 days, never extended). Registered users store null.
 */
export function formatUserDoc(user: UserRecord, now = Date.now()): Record<string, unknown> {
  const plain = buildUserDoc(user, now);
  return {
    ...plain,
    expiresAt: toTimestamp(plain.expiresAt),
  };
}

function timestampLikeToIso(value: unknown): string | null {
  const date = parseExpiresAt(value);
  return date ? date.toISOString() : null;
}

function mapFirestoreUser(uid: string, data: Record<string, unknown>): UserRecord {
  const email = typeof data.email === 'string' && data.email ? data.email : undefined;
  const isAnon = Boolean(data.isAnonymous) && !email;
  return {
    uid: typeof data.uid === 'string' ? data.uid : uid,
    nickname:
      typeof data.nickname === 'string' && data.nickname
        ? data.nickname
        : `Player_${uid.slice(-4)}`,
    locale: typeof data.locale === 'string' ? data.locale : 'en',
    tz: typeof data.tz === 'string' ? data.tz : 'UTC',
    country: typeof data.country === 'string' ? data.country : undefined,
    ageConfirmed16: data.ageConfirmed16 !== false,
    relaxedTimer: Boolean(data.relaxedTimer),
    isAnonymous: isAnon,
    email,
    authProvider:
      (data.authProvider as UserRecord['authProvider']) || (email ? 'password' : 'anonymous'),
    isAdmin: Boolean(data.isAdmin),
    pro: (data.pro as UserRecord['pro']) || { active: false },
    notif: (data.notif as UserRecord['notif']) || {
      pushEnabled: false,
      emailEnabled: false,
      reminderLocalTime: '18:00',
      sentTodayCount: 0,
    },
    streakCurrent: typeof data.streakCurrent === 'number' ? data.streakCurrent : 0,
    streakBest: typeof data.streakBest === 'number' ? data.streakBest : 0,
    lastPlayedDate: typeof data.lastPlayedDate === 'string' ? data.lastPlayedDate : undefined,
    streakShieldUsedWeek:
      typeof data.streakShieldUsedWeek === 'string' ? data.streakShieldUsedWeek : undefined,
    leagueIds: Array.isArray(data.leagueIds) ? (data.leagueIds as string[]) : ['lg_world'],
    lastNicknameChangeAt:
      typeof data.lastNicknameChangeAt === 'string' ? data.lastNicknameChangeAt : undefined,
    freezes: typeof data.freezes === 'number' ? data.freezes : 0,
    freezeLedger: Array.isArray(data.freezeLedger)
      ? (data.freezeLedger as UserRecord['freezeLedger'])
      : undefined,
    duelStats: (data.duelStats as UserRecord['duelStats']) || undefined,
    rivals: (data.rivals as UserRecord['rivals']) || {},
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    expiresAt: timestampLikeToIso(data.expiresAt),
    upgradedAt: typeof data.upgradedAt === 'string' ? data.upgradedAt : null,
  };
}

export async function syncUserToFirestore(user: UserRecord): Promise<void> {
  try {
    const db = getDb();
    const docData = formatUserDoc(user);
    const expiry = docData.expiresAt;
    user.expiresAt = expiry instanceof Timestamp ? expiry.toDate().toISOString() : null;
    await db.collection('users').doc(user.uid).set(docData, { merge: true });
  } catch (err) {
    console.error(`[Firestore] Failed to sync user ${user.uid}:`, err);
  }
}

export async function flushDirtyUsersToFirestore(): Promise<void> {
  const users = consumeDirtyUsers();
  for (const user of users) {
    await syncUserToFirestore(user);
  }
}

async function deleteQuery(query: Query): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await query.limit(PURGE_BATCH).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < PURGE_BATCH) break;
  }
  return total;
}

async function deleteRelatedFirestoreData(uid: string, leagueIds: string[]): Promise<number> {
  const db = getDb();
  let removed = 0;
  const queries = [
    db.collection('plays').where('uid', '==', uid),
    db.collection('duels').where('challengerUid', '==', uid),
    db.collection('duels').where('opponentUid', '==', uid),
    db.collection('reports').where('reporterUid', '==', uid),
    db.collection('shareCards').where('uid', '==', uid),
  ];
  for (const query of queries) {
    try {
      removed += await deleteQuery(query);
    } catch (err) {
      console.error(`[Firestore] Related delete failed for ${uid}:`, err);
    }
  }
  for (const leagueId of leagueIds) {
    try {
      await db.collection('leagues').doc(leagueId).collection('members').doc(uid).delete();
      removed += 1;
    } catch (err) {
      console.error(`[Firestore] Member delete failed ${leagueId}/${uid}:`, err);
    }
  }
  try {
    const tokens = await db
      .collection('users')
      .doc(uid)
      .collection('pushTokens')
      .limit(PURGE_BATCH)
      .get();
    if (!tokens.empty) {
      const batch = db.batch();
      tokens.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      removed += tokens.size;
    }
  } catch (err) {
    console.error(`[Firestore] Push token delete failed for ${uid}:`, err);
  }
  return removed;
}

export async function deleteAnonymousEverywhere(
  uid: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (data?.email) return;
  const leagueIds = Array.isArray(data?.leagueIds) ? (data.leagueIds as string[]) : [];
  purgeAnonymousFromStore(uid);
  await deleteRelatedFirestoreData(uid, leagueIds);
  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== 'auth/user-not-found') {
      console.error(`[Firestore] Auth delete failed for ${uid}:`, err);
    }
  }
  try {
    await getDb().collection('users').doc(uid).delete();
  } catch (err) {
    console.error(`[Firestore] User doc delete failed for ${uid}:`, err);
  }
}

export async function getUserFromFirestore(uid: string): Promise<UserRecord | null> {
  try {
    const db = getDb();
    const docRef = db.collection('users').doc(uid);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const data = snap.data() ?? {};
    const isAnon = Boolean(data.isAnonymous);
    const hasEmail = Boolean(data.email);
    if (isAnon && !hasEmail && data.expiresAt) {
      const expiry = parseExpiresAt(data.expiresAt);
      if (expiry && expiry.getTime() <= Date.now()) {
        console.log(
          `[Firestore] User ${uid} expired after ${7} days without an account. Deleting.`,
        );
        await deleteAnonymousEverywhere(uid, data);
        return null;
      }
    }

    const userRecord = mapFirestoreUser(uid, data);
    getStore().users[uid] = userRecord;
    if (!isPlaceholderNickname(userRecord.nickname)) {
      syncNicknameToLeagues(uid, userRecord.nickname);
    }
    return userRecord;
  } catch (err) {
    console.error(`[Firestore] Failed to get user ${uid}:`, err);
    return null;
  }
}

/**
 * Loads all user docs into store.users once per Cloud Functions instance so every
 * league leaderboard, admin panel, and world ranking resolves from user.nickname
 * rather than stale Player_xxxx rows in store_leagues.
 */
export function ensureUsersHydratedFromFirestore(): Promise<void> {
  if (!usersHydrationPromise) {
    usersHydrationPromise = (async () => {
      const snap = await getDb().collection('users').get();
      const store = getStore();
      let loaded = 0;
      for (const doc of snap.docs) {
        const data = doc.data() ?? {};
        const userRecord = mapFirestoreUser(doc.id, data);
        const existing = store.users[doc.id];
        if (!existing || (isPlaceholderNickname(existing.nickname) && !isPlaceholderNickname(userRecord.nickname))) {
          store.users[doc.id] = userRecord;
        }
        loaded += 1;
      }
      const backfilled = backfillLeagueNicknamesFromUsers();
      console.log(
        `[Firestore] Hydrated ${loaded} users (backfilled ${backfilled} league/duel nickname rows).`,
      );
    })().catch((err) => {
      usersHydrationPromise = null;
      console.error('[Firestore] Failed to hydrate users:', err);
    });
  }
  return usersHydrationPromise;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const snap = await getDb().collection('users').where('email', '==', normalized).limit(1).get();
    const doc = snap.docs[0];
    if (!doc) return null;
    const user = mapFirestoreUser(doc.id, doc.data());
    getStore().users[user.uid] = user;
    return user;
  } catch (err) {
    console.error(`[Firestore] Email lookup failed for ${normalized}:`, err);
    return null;
  }
}

export async function deleteUserFromFirestore(uid: string): Promise<void> {
  try {
    await getDb().collection('users').doc(uid).delete();
  } catch (err) {
    console.error(`[Firestore] Failed to delete user doc ${uid}:`, err);
  }
}

async function loadExpiredCandidates(now: Date): Promise<PurgeCandidate[]> {
  const db = getDb();
  const found = new Map<string, PurgeCandidate>();
  const queries = [
    db
      .collection('users')
      .where('isAnonymous', '==', true)
      .where('expiresAt', '<=', Timestamp.fromDate(now))
      .limit(PURGE_BATCH),
    db
      .collection('users')
      .where('isAnonymous', '==', true)
      .where('expiresAt', '<=', now.toISOString())
      .limit(PURGE_BATCH),
  ];
  for (const query of queries) {
    try {
      const snap = await query.get();
      for (const doc of snap.docs) {
        found.set(doc.id, { id: doc.id, data: doc.data() as PurgeCandidate['data'] });
      }
    } catch (err) {
      console.error('[Firestore] Expired-user query failed:', err);
    }
  }
  return [...found.values()];
}

/**
 * Deletes anonymous users whose expiresAt is in the past, in batches of 400.
 * Users with an email are never deleted. Also removes plays, league membership,
 * duels, share cards, reports, and the Auth user.
 */
export async function purgeExpiredAnonymousUsers(now = new Date()): Promise<{
  deletedCount: number;
  skippedWithEmail: number;
}> {
  try {
    const result = await runAnonymousPurge({
      now,
      batchSize: PURGE_BATCH,
      loadCandidates: loadExpiredCandidates,
      deleteUser: async (uid, data) => {
        await deleteAnonymousEverywhere(uid, data);
      },
    });
    console.log(
      `[Firestore] Purged ${result.deletedCount} expired anonymous user(s); skipped ${result.skippedWithEmail} with email.`,
    );
    return result;
  } catch (err) {
    console.error('[Firestore] Error purging expired anonymous users:', err);
    return { deletedCount: 0, skippedWithEmail: 0 };
  }
}

export async function adoptAuthUid(
  fromUid: string,
  toUid: string,
): Promise<{ uid: string; moved: boolean }> {
  if (!fromUid || !toUid || fromUid === toUid) return { uid: toUid || fromUid, moved: false };
  if (!getStore().users[fromUid]) {
    await getUserFromFirestore(fromUid);
  }
  const result = adoptAnonymousUid(fromUid, toUid);
  if (result.moved) {
    await deleteUserFromFirestore(fromUid);
    const user = getStore().users[toUid];
    if (user) {
      markUserDirty(toUid);
      await syncUserToFirestore(user);
    }
  }
  return result;
}
