import type { Firestore } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';

import { getOrCreateUser, getStore } from '../../apps/web/lib/server-store.js';
import { mergeHydratedUserFromFirestore } from './firestore-users.js';
import { resetStreakTx, useStreakFreezeTx } from './streak-tx.js';
import { createStrictMockFirestore } from './test-firestore-helper.js';

describe('Firestore hydration & transactional streak freeze/reset', () => {
  let rawStore: Map<string, Record<string, unknown>>;
  let db: Firestore;

  beforeEach(() => {
    rawStore = new Map();
    db = createStrictMockFirestore(rawStore) as unknown as Firestore;
    const mem = getStore();
    for (const k of Object.keys(mem.users)) delete mem.users[k];
    for (const k of Object.keys(mem.plays)) delete mem.plays[k];
  });

  it('mergeHydratedUserFromFirestore overwrites stale in-memory user with Firestore progress unless dirty', () => {
    const store = getStore();
    const stale = getOrCreateUser({ uid: 'u_real_1', nickname: 'Andrei', tz: 'UTC' });
    stale.streakCurrent = 1;
    stale.streakBest = 2;
    stale.lastPlayedDate = undefined;
    stale.freezes = 0;

    // Clean (not dirty) -> Firestore wins
    const merged = mergeHydratedUserFromFirestore(
      store,
      'u_real_1',
      {
        uid: 'u_real_1',
        nickname: 'Andrei',
        tz: 'Europe/Bucharest',
        streakCurrent: 5,
        streakBest: 12,
        lastPlayedDate: '2026-11-26',
        freezes: 2,
        frozenDates: ['2026-11-20'],
        pro: { active: true, plan: 'monthly' },
      },
      false,
    );

    expect(merged.streakCurrent).toBe(5);
    expect(merged.streakBest).toBe(12);
    expect(merged.lastPlayedDate).toBe('2026-11-26');
    expect(merged.freezes).toBe(2);
    expect(merged.frozenDates).toEqual(['2026-11-20']);
    expect(merged.tz).toBe('Europe/Bucharest');

    // Dirty -> preserves in-flight in-memory changes
    store.users['u_real_1']!.streakCurrent = 6;
    const kept = mergeHydratedUserFromFirestore(
      store,
      'u_real_1',
      { uid: 'u_real_1', nickname: 'Andrei', streakCurrent: 5 },
      true,
    );
    expect(kept.streakCurrent).toBe(6);
  });

  it('useStreakFreezeTx consumes 1 inventory freeze inside a strict Firestore transaction and is idempotent', async () => {
    rawStore.set('users/u_tx_1', {
      uid: 'u_tx_1',
      nickname: 'Maria',
      tz: 'Europe/Bucharest',
      streakCurrent: 5,
      streakBest: 8,
      lastPlayedDate: '2026-11-25',
      freezes: 2,
      frozenDates: [],
      freezeLedger: [],
      pro: { active: false },
    });

    const now = new Date('2026-11-27T09:30:00+02:00');
    const first = await useStreakFreezeTx(db, { uid: 'u_tx_1', tz: 'Europe/Bucharest', now });
    expect(first.status).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(first.body.noop).toBe(false);
    expect(first.body.freezes).toBe(1);
    expect(first.body.lastPlayedDate).toBe('2026-11-26');
    expect(first.body.source).toBe('inventory');

    const persisted = rawStore.get('users/u_tx_1')!;
    expect(persisted.freezes).toBe(1);
    expect(persisted.lastPlayedDate).toBe('2026-11-26');
    expect(persisted.frozenDates).toEqual(['2026-11-26']);

    // Idempotent second call -> noop, freezes remains 1
    const second = await useStreakFreezeTx(db, { uid: 'u_tx_1', tz: 'Europe/Bucharest', now });
    expect(second.status).toBe(200);
    expect(second.body.noop).toBe(true);
    expect(second.body.freezes).toBe(1);
    expect(rawStore.get('users/u_tx_1')!.freezes).toBe(1);
  });

  it('useStreakFreezeTx uses Pro weekly shield when inventory freezes === 0', async () => {
    rawStore.set('users/u_tx_pro', {
      uid: 'u_tx_pro',
      nickname: 'ProUser',
      tz: 'Europe/Bucharest',
      streakCurrent: 4,
      streakBest: 4,
      lastPlayedDate: '2026-11-25',
      freezes: 0,
      pro: { active: true, plan: 'yearly' },
    });

    const now = new Date('2026-11-27T09:30:00+02:00');
    const res = await useStreakFreezeTx(db, { uid: 'u_tx_pro', tz: 'Europe/Bucharest', now });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('weekly_shield');
    expect(res.body.freezes).toBe(0);
    expect(rawStore.get('users/u_tx_pro')!.streakShieldUsedWeek).toBe('2026-W48');
    expect(rawStore.get('users/u_tx_pro')!.lastPlayedDate).toBe('2026-11-26');
  });

  it('useStreakFreezeTx returns 409 NOT_ENOUGH_FREEZES and writes nothing when user has 0 freezes', async () => {
    const initial = {
      uid: 'u_tx_empty',
      nickname: 'EmptyUser',
      tz: 'Europe/Bucharest',
      streakCurrent: 4,
      streakBest: 4,
      lastPlayedDate: '2026-11-25',
      freezes: 0,
      pro: { active: false },
    };
    rawStore.set('users/u_tx_empty', { ...initial });

    const now = new Date('2026-11-27T09:30:00+02:00');
    const res = await useStreakFreezeTx(db, { uid: 'u_tx_empty', tz: 'Europe/Bucharest', now });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('NOT_ENOUGH_FREEZES');
    expect(rawStore.get('users/u_tx_empty')).toEqual(initial);
  });

  it('useStreakFreezeTx returns 409 TOO_MANY_MISSED_DAYS for 2+ missed days even with 5 freezes and Pro, writing nothing', async () => {
    const initial = {
      uid: 'u_tx_too_many',
      nickname: 'LongGap',
      tz: 'Europe/Bucharest',
      streakCurrent: 9,
      streakBest: 9,
      lastPlayedDate: '2026-11-24', // 2 missed days before Nov 27
      freezes: 5,
      pro: { active: true, plan: 'monthly' },
    };
    rawStore.set('users/u_tx_too_many', { ...initial });

    const now = new Date('2026-11-27T09:30:00+02:00');
    const res = await useStreakFreezeTx(db, { uid: 'u_tx_too_many', tz: 'Europe/Bucharest', now });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('TOO_MANY_MISSED_DAYS');
    expect(rawStore.get('users/u_tx_too_many')).toEqual(initial);
  });

  it('resetStreakTx resets streakCurrent and lastPlayedDate while preserving streakBest and freezes', async () => {
    rawStore.set('users/u_tx_reset', {
      uid: 'u_tx_reset',
      nickname: 'FreshStart',
      tz: 'Europe/Bucharest',
      streakCurrent: 6,
      streakBest: 15,
      lastPlayedDate: '2026-11-24',
      freezes: 3,
      pro: { active: false },
    });

    const res = await resetStreakTx(db, { uid: 'u_tx_reset' });
    expect(res.status).toBe(200);
    expect(res.body.streakCurrent).toBe(0);
    expect(res.body.streakBest).toBe(15);
    expect(res.body.freezes).toBe(3);

    const persisted = rawStore.get('users/u_tx_reset')!;
    expect(persisted.streakCurrent).toBe(0);
    expect(persisted.lastPlayedDate).toBeNull();
    expect(persisted.streakBest).toBe(15);
    expect(persisted.freezes).toBe(3);
  });
});
