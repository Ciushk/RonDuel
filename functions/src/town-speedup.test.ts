import { beforeEach, describe, expect, it } from 'vitest';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { DEFAULT_TOWN_ECONOMY } from '@ronduel/shared';
import { clearEconomyConfigCache } from './town-economy.js';
import { speedupCrop } from './town-speedup.js';
import { createStrictMockFirestore } from './test-firestore-helper.js';

describe('town-speedup', () => {
  beforeEach(() => {
    clearEconomyConfigCache();
  });

  function setupMock(opts: {
    speedupEnabled: boolean;
    balance: number;
    cropId?: string;
    remainingSec?: number;
    plantedAtSec?: number;
  }) {
    const nowMs = 1_700_000_000_000;
    const plantedAtSec = opts.plantedAtSec ?? Math.floor((nowMs - 3600_000) / 1000);
    const readyAtMs = nowMs + (opts.remainingSec ?? 7200) * 1000;
    const initial: Record<string, Record<string, unknown>> = {
      'config/townEconomy': {
        ...DEFAULT_TOWN_ECONOMY,
        enabled: true,
        speedupEnabled: opts.speedupEnabled,
      },
      'users/u_speed/wallet/main': {
        balance: opts.balance,
        buckets: { trivia: 0, town: opts.balance, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      },
      'users/u_speed/town/main': {
        gridSize: 8,
        population: 2,
        housingCapacity: 2,
        serviceCapacity: 4,
        populationCap: 2,
        level: 1,
        maxLevelReached: 1,
        tutorialStep: 3,
        likesCount: 0,
        plotsOwned: 2,
        land: { '3_4': 'basic-block-dirt' },
      },
      'users/u_speed/townTiles/3_4': {
        itemId: 'plot',
        x: 3,
        y: 4,
        cropId: opts.cropId ?? 'wheat',
        plantedAt: Timestamp.fromMillis(plantedAtSec * 1000),
        readyAt: Timestamp.fromMillis(readyAtMs),
      },
    };
    const store = new Map<string, Record<string, unknown>>(Object.entries(initial));
    const db = createStrictMockFirestore(store) as unknown as Firestore;
    return { db, store, nowMs, plantedAtSec };
  }

  it('rejects when speedupEnabled is false', async () => {
    const { db, nowMs } = setupMock({ speedupEnabled: false, balance: 100 });
    await expect(speedupCrop(db, 'u_speed', { x: 3, y: 4, nowMs })).rejects.toThrow(/disabled/i);
  });

  it('debits Option C tier cost (wheat=8, pumpkin=30), marks readyAt=now, enforces reads-before-writes, and is idempotent', async () => {
    const { db, store, nowMs, plantedAtSec } = setupMock({
      speedupEnabled: true,
      balance: 50,
      cropId: 'wheat',
      remainingSec: 5400,
    });

    const first = await speedupCrop(db, 'u_speed', { x: 3, y: 4, expectedCost: 8, nowMs });
    expect(first.ok).toBe(true);
    expect(first.cost).toBe(8);
    expect(first.alreadyReady).toBe(false);
    expect(first.balanceAfter).toBe(42);

    const wallet = store.get('users/u_speed/wallet/main') as { balance: number };
    expect(wallet.balance).toBe(42);

    const ledgerKey = encodeURIComponent(`speedup:u_speed:3_4:${plantedAtSec}`);
    expect(store.has(`ledger/${ledgerKey}`)).toBe(true);

    // Second call on the now-ready crop is a zero-cost idempotent no-op
    const second = await speedupCrop(db, 'u_speed', { x: 3, y: 4, expectedCost: 8, nowMs });
    expect(second.alreadyReady).toBe(true);
    expect(second.cost).toBe(0);
    expect((store.get('users/u_speed/wallet/main') as { balance: number }).balance).toBe(42);
  });

  it('charges pumpkin tier cost (30) and rejects PRICE_CHANGED when expectedCost < cost', async () => {
    const { db, store, nowMs } = setupMock({
      speedupEnabled: true,
      balance: 100,
      cropId: 'pumpkin',
      remainingSec: 20_000,
    });

    await expect(
      speedupCrop(db, 'u_speed', { x: 3, y: 4, expectedCost: 10, nowMs }),
    ).rejects.toThrow(/PRICE_CHANGED/);
    expect((store.get('users/u_speed/wallet/main') as { balance: number }).balance).toBe(100);

    const res = await speedupCrop(db, 'u_speed', { x: 3, y: 4, expectedCost: 30, nowMs });
    expect(res.cost).toBe(30);
    expect(res.balanceAfter).toBe(70);
  });

  it('rejects INSUFFICIENT_FUNDS without mutating wallet or tile', async () => {
    const { db, store, nowMs } = setupMock({
      speedupEnabled: true,
      balance: 5,
      cropId: 'wheat',
      remainingSec: 3600,
    });

    await expect(
      speedupCrop(db, 'u_speed', { x: 3, y: 4, expectedCost: 8, nowMs }),
    ).rejects.toThrow(/INSUFFICIENT_FUNDS/);
    expect((store.get('users/u_speed/wallet/main') as { balance: number }).balance).toBe(5);
    const tile = store.get('users/u_speed/townTiles/3_4') as { speedupAt?: unknown };
    expect(tile.speedupAt).toBeUndefined();
  });

  it('returns alreadyReady with zero debit if crop has already finished naturally', async () => {
    const { db, store, nowMs } = setupMock({
      speedupEnabled: true,
      balance: 20,
      cropId: 'wheat',
      remainingSec: -60,
    });

    const res = await speedupCrop(db, 'u_speed', { x: 3, y: 4, nowMs });
    expect(res.alreadyReady).toBe(true);
    expect(res.cost).toBe(0);
    expect((store.get('users/u_speed/wallet/main') as { balance: number }).balance).toBe(20);
  });
});
