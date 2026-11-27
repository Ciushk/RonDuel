import { beforeEach, describe, expect, it } from 'vitest';
import {
  createStrictMockFirestore,
  FIRESTORE_READ_AFTER_WRITE_ERROR,
} from './test-firestore-helper.js';
import { authorizeTownActor, isTownAdmin } from './town-admin.js';
import { buildItem, removeTile } from './town-actions.js';
import { clearEconomyConfigCache } from './town-economy.js';
import { transferCoins } from './town-transfer.js';
import {
  batchReconcileLedgers,
  creditWallet,
  debitWallet,
  prepareCreditWallet,
  prepareDebitWallet,
  reconcileUserLedger,
} from './town-wallet.js';

describe('town-wallet transaction functions', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    store = new Map();
    mockDb = {
      collection: (col: string) => {
        const colHandler = {
          doc: (id: string) => ({
            collection: (subCol: string) => ({
              doc: (subId: string) => ({
                path: `${col}/${id}/${subCol}/${subId}`,
                get: async () => {
                  const data = store.get(`${col}/${id}/${subCol}/${subId}`);
                  return { exists: data !== undefined, data: () => data };
                },
              }),
            }),
            path: `${col}/${id}`,
            get: async () => {
              const data = store.get(`${col}/${id}`);
              return { exists: data !== undefined, data: () => data };
            },
          }),
          where: (field: string, op: string, val: string) => ({
            get: async () => {
              const docs: any[] = [];
              for (const [p, d] of store.entries()) {
                if (p.startsWith(`${col}/`) && d[field] === val) {
                  docs.push({ id: p.split('/')[1], data: () => d });
                }
              }
              return { docs };
            },
          }),
          orderBy: () => ({
            limit: (n: number) => ({
              startAfter: (afterId: string) => ({
                get: async () => {
                  const sorted = Array.from(
                    new Set(
                      Array.from(store.keys())
                        .filter((k) => k.startsWith(`${col}/`) && k.split('/').length === 2)
                        .map((k) => k.split('/')[1]!),
                    ),
                  ).sort();
                  const afterIndex = sorted.indexOf(afterId);
                  const sliced =
                    afterIndex >= 0 ? sorted.slice(afterIndex + 1, afterIndex + 1 + n) : [];
                  return {
                    docs: sliced.map((id) => ({
                      id,
                      data: () => store.get(`${col}/${id}`),
                    })),
                  };
                },
              }),
              get: async () => {
                const sorted = Array.from(
                  new Set(
                    Array.from(store.keys())
                      .filter((k) => k.startsWith(`${col}/`) && k.split('/').length === 2)
                      .map((k) => k.split('/')[1]!),
                  ),
                )
                  .sort()
                  .slice(0, n);
                return {
                  docs: sorted.map((id) => ({
                    id,
                    data: () => store.get(`${col}/${id}`),
                  })),
                };
              },
            }),
          }),
        };
        return colHandler;
      },
      runTransaction: async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: { path: string }) => {
            const data = store.get(ref.path);
            return { exists: data !== undefined, data: () => data };
          },
          set: (
            ref: { path: string },
            data: Record<string, unknown>,
            options?: { merge?: boolean },
          ) => {
            if (options?.merge && store.has(ref.path)) {
              store.set(ref.path, { ...store.get(ref.path), ...data });
            } else {
              store.set(ref.path, { ...data });
            }
          },
        };
        return fn(tx);
      },
    };
  });

  it('credits wallet, updates balance, and appends unique ledger entry', async () => {
    const res = await mockDb.runTransaction(async (tx: any) => {
      return creditWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_1',
        amount: 50,
        bucket: 'trivia',
        reason: 'trivia_award',
        refId: 'round_1',
        idempotencyKey: 'trivia:user_1:round_1',
      });
    });

    expect(res.duplicate).toBe(false);
    expect(res.balanceAfter).toBe(50);

    const wallet = store.get('users/user_1/wallet/main') as any;
    expect(wallet.balance).toBe(50);
    expect(wallet.buckets.trivia).toBe(50);

    const ledger = store.get('ledger/trivia%3Auser_1%3Around_1') as any;
    expect(ledger.delta).toBe(50);
    expect(ledger.balanceAfter).toBe(50);
    expect(ledger.uid).toBe('user_1');
  });

  it('second credit with identical idempotencyKey returns duplicate without changing balance', async () => {
    // First credit
    await mockDb.runTransaction(async (tx: any) => {
      return creditWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_1',
        amount: 50,
        bucket: 'trivia',
        reason: 'trivia_award',
        refId: 'round_1',
        idempotencyKey: 'trivia:user_1:round_1',
      });
    });

    // Second credit with same key
    const res2 = await mockDb.runTransaction(async (tx: any) => {
      return creditWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_1',
        amount: 50,
        bucket: 'trivia',
        reason: 'trivia_award',
        refId: 'round_1',
        idempotencyKey: 'trivia:user_1:round_1',
      });
    });

    expect(res2.duplicate).toBe(true);
    const wallet = store.get('users/user_1/wallet/main') as any;
    expect(wallet.balance).toBe(50);
  });

  it('debits wallet according to bucket priority', async () => {
    // Initial funding: 30 town coins, 50 purchased coins
    store.set('users/user_2/wallet/main', {
      balance: 80,
      buckets: { trivia: 0, town: 30, purchased: 50, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });

    // Debit 40 coins with priority [town, purchased]
    const res = await mockDb.runTransaction(async (tx: any) => {
      return debitWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_2',
        amount: 40,
        bucketPriority: ['town', 'purchased'],
        reason: 'spend',
        refId: 'item_house',
        idempotencyKey: 'spend:user_2:item_house_1',
      });
    });

    expect(res.duplicate).toBe(false);
    expect(res.balanceAfter).toBe(40);
    expect(res.spentBuckets).toEqual({ town: 30, purchased: 10 });

    const wallet = store.get('users/user_2/wallet/main') as any;
    expect(wallet.balance).toBe(40);
    expect(wallet.buckets.town).toBe(0);
    expect(wallet.buckets.purchased).toBe(40);
  });

  it('rejects debit if balance is insufficient', async () => {
    store.set('users/user_3/wallet/main', {
      balance: 20,
      buckets: { trivia: 20, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });

    await expect(
      mockDb.runTransaction(async (tx: any) => {
        return debitWallet({
          transaction: tx,
          db: mockDb,
          uid: 'user_3',
          amount: 50,
          bucketPriority: ['trivia'],
          reason: 'spend',
          refId: 'item_1',
          idempotencyKey: 'spend:user_3:item_1',
        });
      }),
    ).rejects.toThrow('INSUFFICIENT_FUNDS');
  });

  it('rejects transactions if wallet is locked', async () => {
    store.set('users/user_locked/wallet/main', {
      balance: 50,
      buckets: { trivia: 50, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: true,
    });

    await expect(
      mockDb.runTransaction(async (tx: any) => {
        return creditWallet({
          transaction: tx,
          db: mockDb,
          uid: 'user_locked',
          amount: 10,
          bucket: 'trivia',
          reason: 'trivia_award',
          refId: 'r',
          idempotencyKey: 'k',
        });
      }),
    ).rejects.toThrow('WALLET_LOCKED');
  });

  it('reconcileUserLedger verifies balance matches sum of ledger deltas', async () => {
    store.set('users/user_audit/wallet/main', {
      balance: 85,
      buckets: { trivia: 85, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    // Add 3 ledger entries: +50, +45, -10 = 85
    store.set('ledger/entry_1', { uid: 'user_audit', delta: 50 });
    store.set('ledger/entry_2', { uid: 'user_audit', delta: 45 });
    store.set('ledger/entry_3', { uid: 'user_audit', delta: -10 });

    const audit = await reconcileUserLedger(mockDb, 'user_audit');
    expect(audit.matches).toBe(true);
    expect(audit.balance).toBe(85);
    expect(audit.ledgerSum).toBe(85);

    // If wallet is modified illegally to 100:
    store.set('users/user_audit/wallet/main', {
      balance: 100,
      buckets: { trivia: 100, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    const mismatchAudit = await reconcileUserLedger(mockDb, 'user_audit');
    expect(mismatchAudit.matches).toBe(false);
    expect(mismatchAudit.balance).toBe(100);
    expect(mismatchAudit.ledgerSum).toBe(85);
  });

  it('batchReconcileLedgers iterates paginated users and reports mismatch count', async () => {
    store.set('users/u1', { id: 'u1' });
    store.set('users/u1/wallet/main', { balance: 20 });
    store.set('ledger/u1_1', { uid: 'u1', delta: 20 });

    store.set('users/u2', { id: 'u2' });
    store.set('users/u2/wallet/main', { balance: 50 });
    store.set('ledger/u2_1', { uid: 'u2', delta: 30 }); // Mismatch!

    const page1 = await batchReconcileLedgers(mockDb, 1);
    expect(page1.results).toHaveLength(1);
    expect(page1.lastUid).toBe('u1');
    expect(page1.mismatchCount).toBe(0);

    const page2 = await batchReconcileLedgers(mockDb, 1, page1.lastUid!);
    expect(page2.results).toHaveLength(1);
    expect(page2.lastUid).toBe('u2');
    expect(page2.mismatchCount).toBe(1);
  });

  it('prepareDebitWallet and prepareCreditWallet perform all reads before any writes', async () => {
    const strictStore = new Map<string, Record<string, unknown>>();
    strictStore.set('users/sender/wallet/main', {
      balance: 60,
      buckets: { trivia: 60, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    const strictDb = createStrictMockFirestore(strictStore) as any;

    // Two prepared operations in one transaction succeed because neither writes until apply()
    await strictDb.runTransaction(async (tx: any) => {
      const debit = await prepareDebitWallet({
        transaction: tx,
        db: strictDb,
        uid: 'sender',
        amount: 25,
        bucketPriority: ['trivia'],
        reason: 'transfer_out',
        refId: 'receiver',
        idempotencyKey: 'prep_out:1',
      });
      const credit = await prepareCreditWallet({
        transaction: tx,
        db: strictDb,
        uid: 'receiver',
        amount: 25,
        bucket: 'gift',
        reason: 'transfer_in',
        refId: 'sender',
        idempotencyKey: 'prep_in:1',
      });
      debit.apply();
      credit.apply();
    });

    expect((strictStore.get('users/sender/wallet/main') as any).balance).toBe(35);
    expect((strictStore.get('users/receiver/wallet/main') as any).balance).toBe(25);

    // Reading after apply() must fail with the exact Firestore SDK error
    await expect(
      strictDb.runTransaction(async (tx: any) => {
        const credit = await prepareCreditWallet({
          transaction: tx,
          db: strictDb,
          uid: 'receiver',
          amount: 5,
          bucket: 'town',
          reason: 'order',
          refId: 'ord_1',
          idempotencyKey: 'prep_after_write:1',
        });
        credit.apply();
        await tx.get(strictDb.collection('users').doc('receiver').collection('town').doc('main'));
      }),
    ).rejects.toThrow(FIRESTORE_READ_AFTER_WRITE_ERROR);
  });

  describe('server-only admin RonCoin spend skip', () => {
    it('non-admin with balance 10 attempting debit 20 throws INSUFFICIENT_FUNDS and leaves balance unchanged', async () => {
      const strictStore = new Map<string, Record<string, unknown>>();
      strictStore.set('users/u_regular', {
        uid: 'u_regular',
        isAdmin: false,
        isAnonymous: false,
        email: 'player@example.com',
      });
      strictStore.set('users/u_regular/wallet/main', {
        balance: 10,
        buckets: { trivia: 10, town: 0, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      });
      const strictDb = createStrictMockFirestore(strictStore) as any;

      await expect(
        strictDb.runTransaction((tx: any) =>
          debitWallet({
            transaction: tx,
            db: strictDb,
            uid: 'u_regular',
            amount: 20,
            reason: 'spend',
            refId: 'house',
            idempotencyKey: 'spend:regular:1',
            adminSkip: { verifiedActor: true, hasAdminClaim: false },
          }),
        ),
      ).rejects.toThrow('INSUFFICIENT_FUNDS');

      expect((strictStore.get('users/u_regular/wallet/main') as any).balance).toBe(10);
    });

    it('verified admin (isAdmin=true) with balance 10 succeeds on debit 20 without modifying balance or writing spend ledger', async () => {
      const strictStore = new Map<string, Record<string, unknown>>();
      strictStore.set('users/u_admin', {
        uid: 'u_admin',
        isAdmin: true,
        isAnonymous: false,
        email: 'admin@ronduel.eu',
      });
      strictStore.set('users/u_admin/wallet/main', {
        balance: 10,
        buckets: { trivia: 10, town: 0, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      });
      const strictDb = createStrictMockFirestore(strictStore) as any;

      const actor = await authorizeTownActor(
        { headers: { authorization: 'Bearer valid_admin_token' } },
        'u_admin',
        async () => ({ uid: 'u_admin', admin: true }),
      );
      expect(actor.verified).toBe(true);

      const res = await strictDb.runTransaction((tx: any) =>
        debitWallet({
          transaction: tx,
          db: strictDb,
          uid: 'u_admin',
          amount: 20,
          reason: 'spend',
          refId: 'house',
          idempotencyKey: 'spend:admin:1',
          adminSkip: { verifiedActor: actor.verified, hasAdminClaim: actor.hasAdminClaim },
        }),
      );

      expect(res.adminSkipped).toBe(true);
      expect(res.balanceBefore).toBe(10);
      expect(res.balanceAfter).toBe(10);
      expect((strictStore.get('users/u_admin/wallet/main') as any).balance).toBe(10);

      // Zero spend ledger entries written
      const ledgerKeys = Array.from(strictStore.keys()).filter((k) => k.startsWith('ledger/'));
      expect(ledgerKeys).toHaveLength(0);
    });

    it('admin uid WITHOUT Bearer token or with another uid token never skips debit (throws INSUFFICIENT_FUNDS)', async () => {
      const strictStore = new Map<string, Record<string, unknown>>();
      strictStore.set('users/u_admin', {
        uid: 'u_admin',
        isAdmin: true,
        isAnonymous: false,
        email: 'eu.andrei89@gmail.com',
      });
      strictStore.set('users/u_admin/wallet/main', {
        balance: 10,
        buckets: { trivia: 10, town: 0, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      });
      const strictDb = createStrictMockFirestore(strictStore) as any;

      // Case 1: Missing Bearer header
      const noTokenActor = await authorizeTownActor({ headers: {} }, 'u_admin');
      expect(noTokenActor.verified).toBe(false);

      await expect(
        strictDb.runTransaction((tx: any) =>
          debitWallet({
            transaction: tx,
            db: strictDb,
            uid: 'u_admin',
            amount: 20,
            reason: 'spend',
            refId: 'house',
            idempotencyKey: 'spend:admin:notoken',
            adminSkip: noTokenActor.verified
              ? { verifiedActor: true, hasAdminClaim: noTokenActor.hasAdminClaim }
              : undefined,
          }),
        ),
      ).rejects.toThrow('INSUFFICIENT_FUNDS');

      // Case 2: Valid Bearer token belonging to a DIFFERENT uid
      const otherUidActor = await authorizeTownActor(
        { headers: { authorization: 'Bearer other_user_token' } },
        'u_admin',
        async () => ({ uid: 'u_attacker', admin: false }),
      );
      expect(otherUidActor.verified).toBe(false);

      await expect(
        strictDb.runTransaction((tx: any) =>
          debitWallet({
            transaction: tx,
            db: strictDb,
            uid: 'u_admin',
            amount: 20,
            reason: 'spend',
            refId: 'house',
            idempotencyKey: 'spend:admin:wronguid',
            adminSkip: otherUidActor.verified
              ? { verifiedActor: true, hasAdminClaim: otherUidActor.hasAdminClaim }
              : undefined,
          }),
        ),
      ).rejects.toThrow('INSUFFICIENT_FUNDS');

      expect((strictStore.get('users/u_admin/wallet/main') as any).balance).toBe(10);
    });

    it('transferCoins for an admin still requires real balance (never unlimited)', async () => {
      clearEconomyConfigCache();
      const strictStore = new Map<string, Record<string, unknown>>();
      strictStore.set('config/townEconomy', {
        enabled: true,
        transfersEnabled: true,
      });
      const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
      strictStore.set('users/u_admin', {
        uid: 'u_admin',
        isAdmin: true,
        isAnonymous: false,
        email: 'eu.andrei89@gmail.com',
        pro: { active: true },
        createdAt: tenDaysAgo,
        leagueIds: ['lg_1'],
      });
      strictStore.set('users/u_admin/wallet/main', {
        balance: 10,
        buckets: { trivia: 10, town: 0, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      });
      strictStore.set('users/u_friend', {
        uid: 'u_friend',
        isAdmin: false,
        isAnonymous: false,
        email: 'friend@example.com',
        leagueIds: ['lg_1'],
      });
      const strictDb = createStrictMockFirestore(strictStore) as any;

      await expect(
        transferCoins(strictDb, {
          senderUid: 'u_admin',
          receiverUid: 'u_friend',
          amount: 20,
          idempotencyKey: 'tx_admin_transfer_1',
        }),
      ).rejects.toThrow(/Insufficient trivia coins|INSUFFICIENT_FUNDS/i);

      expect((strictStore.get('users/u_admin/wallet/main') as any).balance).toBe(10);
      expect(strictStore.get('users/u_friend/wallet/main')).toBeUndefined();
    });

    it('bootstraps isAdmin=true on Firestore doc for ADMIN_BOOTSTRAP_EMAILS user on authenticated request', async () => {
      const strictStore = new Map<string, Record<string, unknown>>();
      strictStore.set('users/u_owner', {
        uid: 'u_owner',
        isAdmin: false,
        isAnonymous: false,
        email: 'eu.andrei89@gmail.com',
      });
      strictStore.set('users/u_owner/wallet/main', {
        balance: 5,
        buckets: { trivia: 5, town: 0, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      });
      const strictDb = createStrictMockFirestore(strictStore) as any;

      // Authenticated debit skips spend AND persists isAdmin: true
      const res = await strictDb.runTransaction((tx: any) =>
        debitWallet({
          transaction: tx,
          db: strictDb,
          uid: 'u_owner',
          amount: 25,
          reason: 'spend',
          refId: 'house',
          idempotencyKey: 'spend:bootstrap:1',
          adminSkip: { verifiedActor: true, hasAdminClaim: false },
        }),
      );

      expect(res.adminSkipped).toBe(true);
      expect((strictStore.get('users/u_owner') as any).isAdmin).toBe(true);
      expect((strictStore.get('users/u_owner/wallet/main') as any).balance).toBe(5);

      // Non-transactional isTownAdmin also bootstraps when bootstrapOnVerified is true
      strictStore.set('users/u_owner_2', {
        uid: 'u_owner_2',
        isAdmin: false,
        isAnonymous: false,
        email: 'admin@ronduel.eu',
      });
      expect(await isTownAdmin(strictDb, 'u_owner_2', { bootstrapOnVerified: true })).toBe(true);
      expect((strictStore.get('users/u_owner_2') as any).isAdmin).toBe(true);
    });

    it('admin-built item placed with adminSkip yields 0 refund on removeTile (no fake coin minting)', async () => {
      clearEconomyConfigCache();
      const strictStore = new Map<string, Record<string, unknown>>();
      strictStore.set('config/townEconomy', {
        enabled: true,
        removeRefundRate: 0.5,
        baseServiceCapacity: 10,
        arrivalIntervalSeconds: 3600,
      });
      strictStore.set('users/u_admin', {
        uid: 'u_admin',
        isAdmin: true,
        isAnonymous: false,
        email: 'eu.andrei89@gmail.com',
      });
      strictStore.set('users/u_admin/wallet/main', {
        balance: 0,
        buckets: { trivia: 0, town: 0, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      });
      strictStore.set('users/u_admin/town/main', {
        gridSize: 8,
        population: 2,
        housingCapacity: 2,
        serviceCapacity: 10,
        populationCap: 2,
        level: 1,
        maxLevelReached: 1,
        plotsOwned: 2,
        land: { '3_3': 'basic-block', '3_4': 'basic-block' },
      });
      strictStore.set('users/u_admin/townTiles/3_3', {
        itemId: 'starter_house',
        x: 3,
        y: 3,
      });
      const strictDb = createStrictMockFirestore(strictStore) as any;

      const built = await buildItem(strictDb, 'u_admin', {
        itemId: 'cottage',
        x: 3,
        y: 4,
        adminSkip: { verifiedActor: true, hasAdminClaim: true },
      });
      expect(built.success).toBe(true);
      expect(built.adminSkipped).toBe(true);
      expect((strictStore.get('users/u_admin/wallet/main') as any).balance).toBe(0);

      // Removing the admin-placed cottage must refund 0 coins!
      const removed = await removeTile(strictDb, 'u_admin', { x: 3, y: 4 });
      expect(removed.success).toBe(true);
      expect(removed.refundCoins).toBe(0);
      expect((strictStore.get('users/u_admin/wallet/main') as any).balance).toBe(0);
    });
  });
});
