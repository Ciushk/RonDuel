import { beforeEach, describe, expect, it } from 'vitest';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { DEFAULT_TOWN_ECONOMY, getFamilyEventTriggerAt } from '@ronduel/shared';
import { clearEconomyConfigCache } from './town-economy.js';
import { completeFamilyEvent } from './town-family.js';
import { createStrictMockFirestore } from './test-firestore-helper.js';

describe('town-family', () => {
  beforeEach(() => {
    clearEconomyConfigCache();
  });

  function setupMock(opts: {
    createdAtMs?: number;
    familyClockStartAtMs?: number;
    childBorn?: boolean;
  }) {
    const store = new Map<string, Record<string, unknown>>([
      [
        'config/townEconomy',
        {
          ...DEFAULT_TOWN_ECONOMY,
          enabled: true,
        },
      ],
      [
        'users/u_fam/wallet/main',
        {
          balance: 100,
          buckets: { trivia: 0, town: 100, purchased: 0, gift: 0 },
          monthPurchasedEUR: 0,
          monthKey: '2026-11',
          locked: false,
        },
      ],
      [
        'users/u_fam/town/main',
        {
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
          ...(opts.createdAtMs !== undefined
            ? { createdAt: Timestamp.fromMillis(opts.createdAtMs) }
            : {}),
          ...(opts.familyClockStartAtMs !== undefined
            ? { familyClockStartAt: Timestamp.fromMillis(opts.familyClockStartAtMs) }
            : {}),
          ...(opts.childBorn ? { childBorn: true } : {}),
        },
      ],
    ]);
    const db = createStrictMockFirestore(store) as unknown as Firestore;
    return { db, store };
  }

  it('rejects with NOT_YET before the deterministic trigger window', async () => {
    const createdAtMs = 1_700_000_000_000;
    const triggerAt = getFamilyEventTriggerAt('u_fam', createdAtMs);
    const { db, store } = setupMock({ createdAtMs });

    await expect(completeFamilyEvent(db, 'u_fam', triggerAt - 1000)).rejects.toThrow(/NOT_YET/);
    const town = store.get('users/u_fam/town/main') as { childBorn?: boolean };
    expect(town.childBorn).toBeUndefined();
  });

  it('sets childBorn=true and familyEventSeenAt on/after triggerAt without altering wallet or population, and is idempotent', async () => {
    const createdAtMs = 1_700_000_000_000;
    const triggerAt = getFamilyEventTriggerAt('u_fam', createdAtMs);
    const { db, store } = setupMock({ createdAtMs });

    const first = await completeFamilyEvent(db, 'u_fam', triggerAt);
    expect(first).toEqual({ ok: true, childBorn: true, alreadyBorn: false });

    const town = store.get('users/u_fam/town/main') as {
      childBorn?: boolean;
      population: number;
      familyEventSeenAt?: unknown;
    };
    expect(town.childBorn).toBe(true);
    expect(town.population).toBe(2);
    expect(town.familyEventSeenAt).toBeDefined();
    expect((store.get('users/u_fam/wallet/main') as { balance: number }).balance).toBe(100);

    // Repeat call is idempotent
    const second = await completeFamilyEvent(db, 'u_fam', triggerAt + 5000);
    expect(second).toEqual({ ok: true, childBorn: true, alreadyBorn: true });
  });

  it('supports legacy towns using familyClockStartAt when createdAt is absent', async () => {
    const startMs = 1_700_000_000_000;
    const triggerAt = getFamilyEventTriggerAt('u_fam', startMs);
    const { db } = setupMock({ familyClockStartAtMs: startMs });

    const res = await completeFamilyEvent(db, 'u_fam', triggerAt + 1000);
    expect(res).toEqual({ ok: true, childBorn: true, alreadyBorn: false });
  });
});
