import { getLocalDateString } from '@ronduel/shared';
import type { Firestore } from 'firebase-admin/firestore';

import {
  getStore,
  getUniqueFinishedPlays,
  type UserRecord,
} from '../../apps/web/lib/server-store.js';
import {
  computeFreezeApplication,
  normalizeFrozenDates,
  resolveSafeTimeZone,
} from '../../apps/web/lib/streak-logic.js';
import { mapFirestoreUser } from './firestore-users.js';

export interface StreakTxResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Transactionally consumes a single streak freeze (inventory preferred over Pro weekly shield)
 * to cover exactly 1 missed day (`missedDays === 1`).
 * Never covers 2+ missed days (`TOO_MANY_MISSED_DAYS`, 409) and never writes on error.
 */
export async function useStreakFreezeTx(
  db: Firestore,
  params: { uid: string; tz?: string; now?: Date },
): Promise<StreakTxResult> {
  const { uid } = params;
  if (!uid || uid === 'anon' || uid === 'u_ssr') {
    return { status: 400, body: { error: 'INVALID_UID' } };
  }

  const nowDate = params.now ?? new Date();
  const store = getStore();
  const playedDatesSet = new Set(getUniqueFinishedPlays(store, uid).map((p) => p.date));
  const userRef = db.collection('users').doc(uid);

  const txResult = await db.runTransaction<{
    outcome: StreakTxResult;
    syncedUser: UserRecord | null;
  }>(async (tx) => {
    const snap = await tx.get(userRef);
    const baseUser: UserRecord | null = snap.exists
      ? mapFirestoreUser(uid, (snap.data() ?? {}) as Record<string, unknown>)
      : (store.users[uid] ?? null);

    if (!baseUser) {
      return {
        outcome: { status: 404, body: { error: 'USER_NOT_FOUND' } },
        syncedUser: null,
      };
    }

    const effectiveTz = resolveSafeTimeZone(baseUser.tz || params.tz || 'UTC');
    const today = getLocalDateString(nowDate, effectiveTz);

    const applied = computeFreezeApplication({
      user: baseUser,
      today,
      nowIso: nowDate.toISOString(),
      auto: false,
      playedDatesSet,
    });

    if (!applied.ok) {
      return {
        outcome: {
          status: applied.status ?? 409,
          body: {
            error: applied.error ?? 'FREEZE_UNAVAILABLE',
            missedDays: applied.missedDays,
            freezes: applied.freezes,
            weeklyShieldAvailable: applied.weeklyShieldAvailable,
          },
        },
        syncedUser: null,
      };
    }

    let nextUser: UserRecord = baseUser;
    if (!applied.noop) {
      const normalizedFrozen = normalizeFrozenDates(applied.frozenDates);
      const patch: Record<string, unknown> = {
        freezes: applied.freezes,
        streakShieldUsedWeek: applied.streakShieldUsedWeek ?? null,
        frozenDates: normalizedFrozen,
        freezeLedger: applied.freezeLedger,
        lastPlayedDate: applied.lastPlayedDate ?? null,
        freezeUsedYesterday: false,
      };
      tx.set(userRef, patch, { merge: true });

      nextUser = {
        ...baseUser,
        freezes: applied.freezes,
        streakShieldUsedWeek: applied.streakShieldUsedWeek,
        frozenDates: normalizedFrozen,
        freezeLedger: applied.freezeLedger,
        lastPlayedDate: applied.lastPlayedDate,
        freezeUsedYesterday: false,
      };
    }

    return {
      outcome: {
        status: 200,
        body: {
          ok: true,
          noop: Boolean(applied.noop),
          streakCurrent: applied.streakCurrent,
          freezes: applied.freezes,
          lastPlayedDate: applied.lastPlayedDate ?? null,
          coveredDate: applied.coveredDate ?? null,
          source: applied.source ?? null,
          weeklyShieldAvailable: applied.weeklyShieldAvailable,
          frozenDates: normalizeFrozenDates(applied.frozenDates),
        },
      },
      syncedUser: nextUser,
    };
  });

  if (txResult.syncedUser && txResult.outcome.status === 200) {
    const existing = store.users[uid];
    store.users[uid] = existing ? { ...existing, ...txResult.syncedUser } : txResult.syncedUser;
  }

  return txResult.outcome;
}

/**
 * Transactionally resets a user's current streak to 0 while preserving `streakBest` and `freezes`.
 */
export async function resetStreakTx(
  db: Firestore,
  params: { uid: string },
): Promise<StreakTxResult> {
  const { uid } = params;
  if (!uid || uid === 'anon' || uid === 'u_ssr') {
    return { status: 400, body: { error: 'INVALID_UID' } };
  }

  const store = getStore();
  const userRef = db.collection('users').doc(uid);

  const txResult = await db.runTransaction<{
    outcome: StreakTxResult;
    syncedUser: UserRecord | null;
  }>(async (tx) => {
    const snap = await tx.get(userRef);
    const baseUser: UserRecord | null = snap.exists
      ? mapFirestoreUser(uid, (snap.data() ?? {}) as Record<string, unknown>)
      : (store.users[uid] ?? null);

    if (!baseUser) {
      return {
        outcome: { status: 404, body: { error: 'USER_NOT_FOUND' } },
        syncedUser: null,
      };
    }

    tx.set(
      userRef,
      {
        streakCurrent: 0,
        lastPlayedDate: null,
        freezeUsedYesterday: false,
        streakBeforeToday: 0,
        streakIncreasedDate: null,
      },
      { merge: true },
    );

    const nextUser: UserRecord = {
      ...baseUser,
      streakCurrent: 0,
      lastPlayedDate: undefined,
      freezeUsedYesterday: false,
      streakBeforeToday: 0,
      streakIncreasedDate: undefined,
    };

    return {
      outcome: {
        status: 200,
        body: {
          ok: true,
          streakCurrent: 0,
          streakBest: baseUser.streakBest,
          freezes: baseUser.freezes ?? 0,
        },
      },
      syncedUser: nextUser,
    };
  });

  if (txResult.syncedUser && txResult.outcome.status === 200) {
    const existing = store.users[uid];
    store.users[uid] = existing ? { ...existing, ...txResult.syncedUser } : txResult.syncedUser;
  }

  return txResult.outcome;
}
