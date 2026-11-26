import { beforeEach, describe, expect, it } from 'vitest';
import { createStrictMockFirestore } from './test-firestore-helper.js';
import { clearEconomyConfigCache } from './town-economy.js';
import { rotateTownElement } from './town-rotate.js';

describe('town-rotate server logic', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    clearEconomyConfigCache();
    store = new Map();
    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
      transfersEnabled: false,
      helpEnabled: false,
      baseServiceCapacity: 4,
      removeRefundRate: 0.5,
      arrivalIntervalSeconds: 7200,
    });
    mockDb = createStrictMockFirestore(store);

    store.set('users/u1', { nickname: 'Andrei' });
    store.set('users/u1/wallet/main', {
      balance: 250,
      buckets: { trivia: 0, town: 250, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    store.set('users/u1/town/main', {
      gridSize: 8,
      population: 2,
      housingCapacity: 2,
      serviceCapacity: 4,
      populationCap: 2,
      level: 1,
      maxLevelReached: 1,
      tutorialStep: 3,
      plotsOwned: 2,
      land: {
        '2_2': 'basic-block',
        '3_3': 'basic-block-wather-grass-50-50',
        '4_4': 'basic-block-street',
      },
    });
    store.set('users/u1/townTiles/2_2', { itemId: 'fence', x: 2, y: 2 });
    store.set('users/u1/townTiles/3_4', { itemId: 'plot', x: 3, y: 4 });
  });

  it('rotates a rot4 shore ground tile through 1..3 and deletes landRot entry when returning to 0 (idempotent)', async () => {
    const r1 = await rotateTownElement(mockDb, 'u1', { x: 3, y: 3, layer: 'ground', rot: 1 });
    expect(r1).toEqual({ success: true, rot: 1 });
    expect((store.get('users/u1/town/main')?.landRot as Record<string, number>)['3_3']).toBe(1);

    // Idempotent repeat of rot: 1
    const r1Again = await rotateTownElement(mockDb, 'u1', { x: 3, y: 3, layer: 'ground', rot: 1 });
    expect(r1Again).toEqual({ success: true, rot: 1 });

    const r3 = await rotateTownElement(mockDb, 'u1', { x: 3, y: 3, layer: 'ground', rot: 3 });
    expect(r3).toEqual({ success: true, rot: 3 });
    expect((store.get('users/u1/town/main')?.landRot as Record<string, number>)['3_3']).toBe(3);

    const r0 = await rotateTownElement(mockDb, 'u1', { x: 3, y: 3, layer: 'ground', rot: 0 });
    expect(r0).toEqual({ success: true, rot: 0 });
    expect(
      (store.get('users/u1/town/main')?.landRot as Record<string, number>)['3_3'],
    ).toBeUndefined();

    // Never touches wallet or ledger
    expect(store.get('users/u1/wallet/main')?.balance).toBe(250);
    expect(Array.from(store.keys()).filter((k) => k.includes('ledger'))).toHaveLength(0);
  });

  it('normalizes flip2 items and ground streets via rot % 2 and deletes rot field at 0', async () => {
    // rot=3 on flip2 fence normalizes to 1
    const rItem = await rotateTownElement(mockDb, 'u1', { x: 2, y: 2, layer: 'item', rot: 3 });
    expect(rItem).toEqual({ success: true, rot: 1 });
    expect(store.get('users/u1/townTiles/2_2')?.rot).toBe(1);

    // Returning to 0 deletes field
    const rItem0 = await rotateTownElement(mockDb, 'u1', { x: 2, y: 2, layer: 'item', rot: 2 });
    expect(rItem0).toEqual({ success: true, rot: 0 });
    expect(store.get('users/u1/townTiles/2_2')?.rot).toBeUndefined();

    // Street ground flip2
    const rStreet = await rotateTownElement(mockDb, 'u1', { x: 4, y: 4, layer: 'ground', rot: 3 });
    expect(rStreet).toEqual({ success: true, rot: 1 });
  });

  it('rejects non-rotatable items/ground (NOT_ROTATABLE), invalid rot, unowned land, and anon uid', async () => {
    await expect(
      rotateTownElement(mockDb, 'u1', { x: 2, y: 2, layer: 'ground', rot: 1 }),
    ).rejects.toThrow('NOT_ROTATABLE');

    await expect(
      rotateTownElement(mockDb, 'u1', { x: 3, y: 4, layer: 'item', rot: 1 }),
    ).rejects.toThrow('NOT_ROTATABLE');

    await expect(
      rotateTownElement(mockDb, 'u1', { x: 3, y: 3, layer: 'ground', rot: 4 }),
    ).rejects.toThrow('Invalid rotation');

    await expect(
      rotateTownElement(mockDb, 'u1', { x: 7, y: 7, layer: 'ground', rot: 1 }),
    ).rejects.toThrow('not owned land');

    await expect(
      rotateTownElement(mockDb, 'anon', { x: 3, y: 3, layer: 'ground', rot: 1 }),
    ).rejects.toThrow('Missing uid');
  });
});
