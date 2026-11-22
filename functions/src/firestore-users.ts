import { getFirestore } from 'firebase-admin/firestore';
import {
  deleteUserData,
  getOrCreateUser,
  getStore,
  type UserRecord,
} from '../../apps/web/lib/server-store.js';

export function getDb() {
  return getFirestore();
}

/**
 * Converts a UserRecord into a Firestore document format.
 */
export function formatUserDoc(user: UserRecord): Record<string, any> {
  const isAnon = user.isAnonymous ?? true;
  const hasEmail = Boolean(user.email);

  // If user has email or is registered, expiresAt is null (permanent).
  // If user is anonymous without email, expiresAt is 7 days from now (or preserves existing expiresAt).
  let expiresAt: string | null = null;
  if (isAnon && !hasEmail) {
    if (user.expiresAt && new Date(user.expiresAt).getTime() > Date.now()) {
      expiresAt = user.expiresAt;
    } else {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  return {
    uid: user.uid,
    nickname: user.nickname,
    locale: user.locale || 'en',
    tz: user.tz || 'UTC',
    isAnonymous: isAnon && !hasEmail,
    email: user.email || null,
    authProvider: user.authProvider || 'anonymous',
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
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt,
  };
}

/**
 * Saves or updates a user in Firestore.
 */
export async function syncUserToFirestore(user: UserRecord): Promise<void> {
  try {
    const db = getDb();
    const docData = formatUserDoc(user);
    user.expiresAt = docData.expiresAt;
    await db.collection('users').doc(user.uid).set(docData, { merge: true });
  } catch (err) {
    console.error(`[Firestore] Failed to sync user ${user.uid}:`, err);
  }
}

/**
 * Retrieves a user from Firestore, verifying 7-day expiration for anonymous users.
 */
export async function getUserFromFirestore(uid: string): Promise<UserRecord | null> {
  try {
    const db = getDb();
    const docRef = db.collection('users').doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      return null;
    }

    const data = snap.data()!;
    const isAnon = data.isAnonymous ?? true;
    const hasEmail = Boolean(data.email);

    // 7-day expiry check: if anonymous without email and expiresAt has passed, delete everything!
    if (isAnon && !hasEmail && data.expiresAt) {
      const expiryTime = new Date(data.expiresAt).getTime();
      if (expiryTime <= Date.now()) {
        console.log(`[Firestore] User ${uid} expired after 7 days without account. Deleting...`);
        await docRef.delete();
        deleteUserData(uid);
        return null;
      }
    }

    // Sync into in-memory store
    const store = getStore();
    const userRecord: UserRecord = {
      uid: data.uid || uid,
      nickname: data.nickname || `Player_${uid.slice(-4)}`,
      locale: data.locale || 'en',
      tz: data.tz || 'UTC',
      ageConfirmed16: true,
      relaxedTimer: false,
      isAnonymous: isAnon && !hasEmail,
      email: data.email || undefined,
      authProvider: data.authProvider || 'anonymous',
      isAdmin: Boolean(data.isAdmin),
      pro: data.pro || { active: false },
      notif: data.notif || {
        pushEnabled: false,
        emailEnabled: false,
        reminderLocalTime: '18:00',
        sentTodayCount: 0,
      },
      streakCurrent: data.streakCurrent ?? 0,
      streakBest: data.streakBest ?? 0,
      lastPlayedDate: data.lastPlayedDate || undefined,
      leagueIds: Array.isArray(data.leagueIds) ? data.leagueIds : ['lg_world'],
      freezes: data.freezes ?? 0,
      duelStats: data.duelStats || undefined,
      createdAt: data.createdAt || new Date().toISOString(),
      expiresAt: data.expiresAt || null,
    };

    store.users[uid] = userRecord;
    return userRecord;
  } catch (err) {
    console.error(`[Firestore] Failed to get user ${uid}:`, err);
    return null;
  }
}

/**
 * Deletes a user document from Firestore.
 */
export async function deleteUserFromFirestore(uid: string): Promise<void> {
  try {
    const db = getDb();
    await db.collection('users').doc(uid).delete();
  } catch (err) {
    console.error(`[Firestore] Failed to delete user doc ${uid}:`, err);
  }
}

/**
 * Purges all anonymous users whose 7-day retention period has expired.
 */
export async function purgeExpiredAnonymousUsers(): Promise<{ deletedCount: number }> {
  try {
    const db = getDb();
    const nowIso = new Date().toISOString();

    const snapshot = await db
      .collection('users')
      .where('isAnonymous', '==', true)
      .where('expiresAt', '<=', nowIso)
      .get();

    let deletedCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Only delete if user is truly anonymous without email
      if (data.isAnonymous && !data.email) {
        deleteUserData(doc.id);
        batch.delete(doc.ref);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await batch.commit();
    }

    console.log(`[Firestore] Purged ${deletedCount} expired anonymous user(s).`);
    return { deletedCount };
  } catch (err) {
    console.error('[Firestore] Error purging expired anonymous users:', err);
    return { deletedCount: 0 };
  }
}
